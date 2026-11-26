import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../../deps.ts';
import { actorOf, requireAdmin, requireSuper } from '../../plugins/admin-session.ts';
import { badRequest, conflict, notFound, tooMany } from '../../lib/errors.ts';
import { maskPhone } from '../../lib/phone.ts';
import { addDays, startOfIstDay } from '../../lib/time.ts';
import { parse } from '../../lib/validate.ts';
import { audit } from '../../services/audit.ts';
import type { Prisma } from '../../services/db.ts';
import { getSetting } from '../../services/settings.ts';
import { idParams, pageQuery, paging, reason } from './common.ts';

const audienceBody = z
  .object({ audience: z.enum(['all', 'city', 'listers']), cityId: z.uuid().nullable().optional() })
  .strict()
  .refine((b) => b.audience !== 'city' || !!b.cityId, { message: 'Choose a city', path: ['cityId'] });

export function audienceWhere(audience: 'all' | 'city' | 'listers', cityId?: string | null): Prisma.UserWhereInput {
  return {
    status: 'ACTIVE',
    deviceTokens: { some: {} },
    ...(audience === 'city' ? { cityId: cityId! } : {}),
    ...(audience === 'listers' ? { isLister: true, ...(cityId ? { cityId } : {}) } : {}),
  };
}

const csvCell = (v: unknown) => {
  const s = String(v ?? '');
  // Leading = + - @ would run as a formula in Excel. Prefix with a quote.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export default async function adminOpsRoutes(app: FastifyInstance, deps: Deps) {
  // ------------------------------------------------------------ dashboard (W-08)

  app.get('/admin/dashboard', { preHandler: requireAdmin }, async (req) => {
    const { cityId } = parse(z.object({ cityId: z.uuid().optional() }).strict(), req.query);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const userCity = cityId ? { cityId } : {};
    const [users, listers, live, pendingPayments, pendingReview, openReports, revenue, trend, recent] = await Promise.all([
      deps.db.user.count({ where: { status: 'ACTIVE', ...userCity } }),
      deps.db.user.count({ where: { status: 'ACTIVE', ...userCity, subscriptions: { some: { status: { in: ['ACTIVE', 'EXPIRING'] } } } } }),
      deps.db.listing.count({ where: { status: 'LIVE', ...(cityId ? { cityId } : {}) } }),
      deps.db.payment.count({ where: { status: 'PENDING', ...(cityId ? { user: { cityId } } : {}) } }),
      deps.db.listing.count({ where: { status: 'REVIEW', ...(cityId ? { cityId } : {}) } }),
      deps.db.report.count({ where: { status: 'OPEN' } }),
      deps.db.payment.aggregate({ where: { status: 'APPROVED', reviewedAt: { gte: monthStart }, ...(cityId ? { user: { cityId } } : {}) }, _sum: { amountPaise: true } }),
      deps.db.$queryRaw<Array<{ day: string; paise: bigint }>>`
        SELECT to_char(date_trunc('day', p."reviewedAt" AT TIME ZONE 'Asia/Kolkata'), 'YYYY-MM-DD') AS day, sum(p."amountPaise")::bigint AS paise
        FROM "Payment" p JOIN "User" u ON u.id = p."userId"
        WHERE p.status = 'APPROVED' AND p."reviewedAt" >= ${addDays(now, -30)}
          AND (${cityId ?? null}::uuid IS NULL OR u."cityId" = ${cityId ?? null}::uuid)
        GROUP BY 1 ORDER BY 1`,
      deps.db.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 10, select: { action: true, entity: true, createdAt: true, actorId: true } }),
    ]);
    return {
      users,
      activeListers: listers,
      liveItems: live,
      pendingPayments,
      pendingReview,
      openReports,
      revenueThisMonthPaise: revenue._sum.amountPaise ?? 0,
      revenueTrend: trend.map((t) => ({ day: t.day, paise: Number(t.paise) })),
      recent,
    };
  });

  // ------------------------------------------------------------ push (W-12)

  app.post('/admin/push/preview', { preHandler: requireAdmin }, async (req) => {
    const body = parse(audienceBody, req.body);
    return { audienceSize: await deps.db.user.count({ where: audienceWhere(body.audience, body.cityId) }) };
  });

  app.post('/admin/push', { preHandler: requireAdmin }, async (req) => {
    const body = parse(
      z.object({ audience: z.enum(['all', 'city', 'listers']), cityId: z.uuid().nullable().optional(), title: z.string().trim().min(3).max(60), body: z.string().trim().min(3).max(160) }).strict(),
      req.body,
    );
    if (body.audience === 'city' && !body.cityId) throw badRequest('Choose a city', 'NO_CITY');
    const { broadcastsPerDay } = await getSetting(deps.db, 'limits');
    const today = await deps.db.broadcast.count({ where: { createdAt: { gte: startOfIstDay() } } });
    if (today >= broadcastsPerDay) throw tooMany(`Only ${broadcastsPerDay} broadcasts a day`, 'BROADCAST_LIMIT');
    const targetCount = await deps.db.user.count({ where: audienceWhere(body.audience, body.cityId) });
    const b = await deps.db.broadcast.create({
      data: { audience: body.audience, cityId: body.cityId ?? null, title: body.title, body: body.body, sentById: req.admin!.id, targetCount },
    });
    await audit(deps.db, actorOf(req), 'push.broadcast', 'Broadcast', b.id, null, { audience: body.audience, cityId: body.cityId, title: body.title, targetCount });
    await deps.jobs.enqueue('broadcast', { broadcastId: b.id });
    return { id: b.id, targetCount };
  });

  app.get('/admin/push', { preHandler: requireAdmin }, async () => {
    const items = await deps.db.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
    return { items };
  });

  // ------------------------------------------------------------ insights (W-16)

  app.get('/admin/insights', { preHandler: requireAdmin }, async (req, reply) => {
    const q = parse(z.object({ days: z.coerce.number().int().min(1).max(365).default(30), cityId: z.uuid().optional(), format: z.enum(['json', 'csv']).default('json') }).strict(), req.query);
    const since = addDays(new Date(), -q.days);
    const cityFilter = q.cityId ?? null;
    const [top, zero, byCategory, byCity, planRevenue] = await Promise.all([
      deps.db.$queryRaw<Array<{ query: string; n: bigint; avg: number }>>`
        SELECT query, count(*)::bigint AS n, avg("resultCount")::float AS avg FROM "SearchLog"
        WHERE "createdAt" >= ${since} AND query IS NOT NULL AND (${cityFilter}::uuid IS NULL OR "cityId" = ${cityFilter}::uuid)
        GROUP BY query ORDER BY n DESC LIMIT 30`,
      deps.db.$queryRaw<Array<{ query: string; n: bigint }>>`
        SELECT query, count(*)::bigint AS n FROM "SearchLog"
        WHERE "createdAt" >= ${since} AND query IS NOT NULL AND "resultCount" = 0 AND (${cityFilter}::uuid IS NULL OR "cityId" = ${cityFilter}::uuid)
        GROUP BY query ORDER BY n DESC LIMIT 30`,
      deps.db.$queryRaw<Array<{ name: string; live: bigint; searches: bigint }>>`
        SELECT c.name,
          (SELECT count(*) FROM "Listing" l WHERE l."categoryId" = c.id AND l.status = 'LIVE' AND (${cityFilter}::uuid IS NULL OR l."cityId" = ${cityFilter}::uuid))::bigint AS live,
          (SELECT count(*) FROM "SearchLog" s WHERE s."categoryId" = c.id AND s."createdAt" >= ${since} AND (${cityFilter}::uuid IS NULL OR s."cityId" = ${cityFilter}::uuid))::bigint AS searches
        FROM "Category" c ORDER BY c."sortOrder"`,
      deps.db.$queryRaw<Array<{ name: string; live: bigint; users: bigint; searches: bigint }>>`
        SELECT ci.name,
          (SELECT count(*) FROM "Listing" l WHERE l."cityId" = ci.id AND l.status = 'LIVE')::bigint AS live,
          (SELECT count(*) FROM "User" u WHERE u."cityId" = ci.id AND u.status = 'ACTIVE')::bigint AS users,
          (SELECT count(*) FROM "SearchLog" s WHERE s."cityId" = ci.id AND s."createdAt" >= ${since})::bigint AS searches
        FROM "City" ci ORDER BY ci.name`,
      deps.db.$queryRaw<Array<{ plan: string; n: bigint; paise: bigint }>>`
        SELECT s."planName" AS plan, count(*)::bigint AS n, sum(p."amountPaise")::bigint AS paise
        FROM "Payment" p JOIN "Subscription" s ON s.id = p."subscriptionId"
        WHERE p.status = 'APPROVED' AND p."reviewedAt" >= ${since}
        GROUP BY s."planName" ORDER BY paise DESC`,
    ]);
    const data = {
      topSearches: top.map((t) => ({ query: t.query, count: Number(t.n), avgResults: Math.round(t.avg) })),
      zeroResults: zero.map((t) => ({ query: t.query, count: Number(t.n) })),
      categories: byCategory.map((c) => ({ name: c.name, live: Number(c.live), searches: Number(c.searches) })),
      cities: byCity.map((c) => ({ name: c.name, live: Number(c.live), users: Number(c.users), searches: Number(c.searches) })),
      planRevenue: planRevenue.map((p) => ({ plan: p.plan, count: Number(p.n), paise: Number(p.paise) })),
    };
    if (q.format === 'csv') {
      // Aggregates only. No names, numbers or ids.
      const lines = [
        'section,label,count,extra',
        ...data.topSearches.map((t) => ['top_search', t.query, t.count, t.avgResults].map(csvCell).join(',')),
        ...data.zeroResults.map((t) => ['zero_result', t.query, t.count, ''].map(csvCell).join(',')),
        ...data.categories.map((c) => ['category', c.name, c.live, c.searches].map(csvCell).join(',')),
        ...data.cities.map((c) => ['city', c.name, c.live, c.searches].map(csvCell).join(',')),
        ...data.planRevenue.map((p) => ['plan_revenue', p.plan, p.count, p.paise / 100].map(csvCell).join(',')),
      ];
      await audit(deps.db, actorOf(req), 'insights.export', 'Insights', null, null, { days: q.days });
      reply.header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', 'attachment; filename="rentnook-insights.csv"');
      return lines.join('\n');
    }
    return data;
  });

  // ------------------------------------------------------------ ID verification (W-15, Super admin only)

  app.get('/admin/id-verifications', { preHandler: requireSuper }, async (req) => {
    const q = parse(z.object({ ...pageQuery, status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING') }).strict(), req.query);
    const [rows, total] = await Promise.all([
      deps.db.idVerification.findMany({
        where: { status: q.status },
        orderBy: { createdAt: q.status === 'PENDING' ? 'asc' : 'desc' },
        ...paging(q),
        include: { user: { select: { id: true, name: true, phone: true, createdAt: true, city: { select: { name: true } }, _count: { select: { listings: true } } } } },
      }),
      deps.db.idVerification.count({ where: { status: q.status } }),
    ]);
    return {
      total,
      items: rows.map((r) => ({
        id: r.id, status: r.status, createdAt: r.createdAt, decidedAt: r.decidedAt, rejectReason: r.rejectReason, hasDocument: !!r.docKey,
        user: { id: r.user.id, name: r.user.name, phoneMasked: maskPhone(r.user.phone), city: r.user.city?.name ?? null, since: r.user.createdAt, listings: r.user._count.listings },
      })),
    };
  });

  app.get('/admin/id-verifications/:id/document', { preHandler: requireSuper }, async (req) => {
    const { id } = parse(idParams, req.params);
    const r = await deps.db.idVerification.findUnique({ where: { id } });
    if (!r?.docKey) throw notFound('Document already deleted');
    await audit(deps.db, actorOf(req), 'id.view_document', 'IdVerification', id);
    return { url: await deps.storage.signGet('private', r.docKey, 600) };
  });

  app.post('/admin/id-verifications/:id', { preHandler: requireSuper }, async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(z.object({ decision: z.enum(['approve', 'reject']), reason: reason.optional() }).strict(), req.body);
    if (body.decision === 'reject' && !body.reason) throw badRequest('Add a reason', 'NO_REASON');
    const now = new Date();
    const r = await deps.db.$transaction(async (tx) => {
      const res = await tx.idVerification.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: body.decision === 'approve' ? 'APPROVED' : 'REJECTED', rejectReason: body.reason ?? null, reviewedById: req.admin!.id, decidedAt: now, deleteAfter: addDays(now, 30) },
      });
      if (res.count !== 1) throw conflict('Already decided', 'ALREADY_DONE');
      const row = await tx.idVerification.findUniqueOrThrow({ where: { id } });
      if (body.decision === 'approve') await tx.user.update({ where: { id: row.userId }, data: { idVerified: true } });
      await audit(tx, actorOf(req), `id.${body.decision}`, 'IdVerification', id, { status: 'PENDING' }, { status: row.status, reason: body.reason });
      return row;
    });
    await deps.notifier.toUser(r.userId, body.decision === 'approve' ? 'ID_APPROVED' : 'ID_REJECTED', { reason: body.reason ?? '' });
    return { ok: true };
  });
}
