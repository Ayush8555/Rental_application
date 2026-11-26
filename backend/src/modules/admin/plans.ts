import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../../deps.ts';
import { actorOf, requireAdmin } from '../../plugins/admin-session.ts';
import { badRequest, conflict, notFound } from '../../lib/errors.ts';
import { parse } from '../../lib/validate.ts';
import { audit } from '../../services/audit.ts';
import { startSubscription } from '../billing.ts';
import { idParams, pageQuery, paging, reason } from './common.ts';

const planBody = z
  .object({
    name: z.string().trim().min(2).max(40),
    nameHi: z.string().trim().min(1).max(40),
    type: z.enum(['PAID', 'FREE', 'TRIAL', 'BUSINESS']),
    pricePaise: z.number().int().min(0).max(10_000_000),
    durationDays: z.number().int().min(1).max(730),
    listingLimit: z.number().int().min(1).max(10_000).nullable(),
    boostCredits: z.number().int().min(0).max(50).default(0),
    shopPage: z.boolean().default(false),
    maxPerUser: z.number().int().min(1).max(100).nullable(),
    needsApproval: z.boolean().default(false),
    visibility: z.enum(['PUBLIC', 'HIDDEN', 'ARCHIVED']).default('PUBLIC'),
    allCities: z.boolean().default(true),
    cityIds: z.array(z.uuid()).max(200).default([]),
    validFrom: z.iso.datetime().nullable().optional(),
    validTo: z.iso.datetime().nullable().optional(),
    badge: z.string().trim().max(20).nullable().optional(),
    badgeHi: z.string().trim().max(20).nullable().optional(),
    sortOrder: z.number().int().min(0).max(1000).default(0),
    points: z.array(z.string().trim().min(1).max(60)).max(4).default([]),
    pointsHi: z.array(z.string().trim().min(1).max(60)).max(4).default([]),
  })
  .strict();

type PlanInput = z.infer<typeof planBody>;

function checkPlan(p: PlanInput) {
  const free = p.type === 'FREE' || p.type === 'TRIAL';
  if (free && p.pricePaise !== 0) throw badRequest('Free and trial plans must have price 0', 'BAD_PRICE');
  if (!free && p.pricePaise === 0) throw badRequest('Paid plans need a price. Use type Free for ₹0 plans.', 'BAD_PRICE');
  if (p.pricePaise > 0 && p.pricePaise < 100) throw badRequest('Minimum price is ₹1', 'BAD_PRICE');
  if (p.pricePaise % 100 !== 0) throw badRequest('Use whole rupees', 'BAD_PRICE');
  if (free && p.maxPerUser === null) throw badRequest('Free plans need "max times per user"', 'NEEDS_MAX');
  if (!p.allCities && p.cityIds.length === 0) throw badRequest('Choose at least one city', 'NO_CITIES');
  if (p.validFrom && p.validTo && p.validFrom >= p.validTo) throw badRequest('End date must be after start date', 'BAD_DATES');
  if (p.type === 'BUSINESS') p.shopPage = true;
}

const toData = (p: PlanInput) => ({
  ...p,
  validFrom: p.validFrom ? new Date(p.validFrom) : null,
  validTo: p.validTo ? new Date(p.validTo) : null,
  badge: p.badge ?? null,
  badgeHi: p.badgeHi ?? null,
});

export default async function adminPlanRoutes(app: FastifyInstance, deps: Deps) {
  app.get('/admin/plans', { preHandler: requireAdmin }, async () => {
    const plans = await deps.db.plan.findMany({ orderBy: [{ visibility: 'asc' }, { sortOrder: 'asc' }] });
    const active = await deps.db.subscription.groupBy({ by: ['planId'], where: { status: { in: ['ACTIVE', 'EXPIRING'] } }, _count: true });
    const ever = await deps.db.subscription.groupBy({ by: ['planId'], _count: true });
    const a = new Map(active.map((x) => [x.planId, x._count]));
    const e = new Map(ever.map((x) => [x.planId, x._count]));
    return { items: plans.map((p) => ({ ...p, activeSubscribers: a.get(p.id) ?? 0, everBought: e.get(p.id) ?? 0 })) };
  });

  app.post('/admin/plans', { preHandler: requireAdmin }, async (req) => {
    const body = parse(planBody, req.body);
    checkPlan(body);
    const plan = await deps.db.plan.create({ data: toData(body) });
    await audit(deps.db, actorOf(req), 'plan.create', 'Plan', plan.id, null, plan);
    return plan;
  });

  // Editing changes only future purchases: subscriptions hold a snapshot.
  app.put('/admin/plans/:id', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(planBody, req.body);
    checkPlan(body);
    const before = await deps.db.plan.findUnique({ where: { id } });
    if (!before) throw notFound();
    const after = await deps.db.plan.update({ where: { id }, data: toData(body) });
    await audit(deps.db, actorOf(req), 'plan.update', 'Plan', id, before, after);
    return after;
  });

  app.delete('/admin/plans/:id', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const used = await deps.db.subscription.count({ where: { planId: id } });
    if (used) throw conflict('People have bought this plan, so it can only be archived', 'PLAN_IN_USE');
    const before = await deps.db.plan.delete({ where: { id } }).catch(() => null);
    if (!before) throw notFound();
    await audit(deps.db, actorOf(req), 'plan.delete', 'Plan', id, before, null);
    return { ok: true };
  });

  // Free plans that need approval (12.2).
  app.get('/admin/plan-requests', { preHandler: requireAdmin }, async (req) => {
    const q = parse(z.object(pageQuery).strict(), req.query);
    const where = { status: 'PENDING' as const, payment: null, pricePaise: 0 };
    const [rows, total] = await Promise.all([
      deps.db.subscription.findMany({ where, orderBy: { createdAt: 'asc' }, ...paging(q), include: { user: { select: { id: true, name: true, city: { select: { name: true } }, createdAt: true } } } }),
      deps.db.subscription.count({ where }),
    ]);
    return { total, items: rows.map((s) => ({ id: s.id, planName: s.planName, createdAt: s.createdAt, user: { id: s.user.id, name: s.user.name, city: s.user.city?.name ?? null, since: s.user.createdAt } })) };
  });

  app.post('/admin/plan-requests/:id', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(z.object({ decision: z.enum(['approve', 'reject']), reason: reason.optional() }).strict(), req.body);
    const sub = await deps.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Subscription" WHERE id = ${id}::uuid FOR UPDATE`;
      const s = await tx.subscription.findUnique({ where: { id }, include: { payment: true } });
      if (!s || s.status !== 'PENDING' || s.payment || s.pricePaise !== 0) throw conflict('This request was already handled', 'ALREADY_DONE');
      const result =
        body.decision === 'approve'
          ? await startSubscription(tx, id)
          : await tx.subscription.update({ where: { id }, data: { status: 'REJECTED', cancelReason: body.reason ?? 'Not approved' } });
      await audit(tx, actorOf(req), `plan_request.${body.decision}`, 'Subscription', id, { status: 'PENDING' }, { status: result.status, reason: body.reason });
      return result;
    });
    if (sub.status !== 'REJECTED') await deps.notifier.toUser(sub.userId, 'PLAN_ACTIVATED', { plan: sub.planName, date: sub.endsAt!.toISOString().slice(0, 10) });
    return { ok: true, status: sub.status };
  });
}
