import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../../deps.ts';
import { actorOf, requireAdmin, requireStepUp } from '../../plugins/admin-session.ts';
import { badRequest, forbidden, notFound } from '../../lib/errors.ts';
import { maskPhone } from '../../lib/phone.ts';
import { parse } from '../../lib/validate.ts';
import { audit } from '../../services/audit.ts';
import type { Prisma } from '../../services/db.ts';
import { snapshot, startSubscription } from '../billing.ts';
import { blockUser } from './moderation.ts';
import { idParams, pageQuery, paging, reason } from './common.ts';

export default async function adminUserRoutes(app: FastifyInstance, deps: Deps) {
  app.get('/admin/users', { preHandler: requireAdmin }, async (req) => {
    const q = parse(
      z
        .object({
          ...pageQuery,
          q: z.string().trim().max(60).optional(),
          status: z.enum(['ACTIVE', 'BLOCKED', 'DELETED']).optional(),
          listers: z.enum(['true', 'false']).optional(),
          cityId: z.uuid().optional(),
        })
        .strict(),
      req.query,
    );
    // Search by name, or by the last 4 digits of the number. No full-number
    // search: that would turn the panel into a "whose number is this" tool.
    const where: Prisma.UserWhereInput = {
      status: q.status,
      cityId: q.cityId,
      isLister: q.listers ? q.listers === 'true' : undefined,
      ...(q.q
        ? /^\d{4}$/.test(q.q)
          ? { phone: { endsWith: q.q } }
          : { name: { contains: q.q, mode: 'insensitive' } }
        : {}),
    };
    const [rows, total] = await Promise.all([
      deps.db.user.findMany({ where, orderBy: { createdAt: 'desc' }, ...paging(q), include: { city: true, _count: { select: { listings: true } } } }),
      deps.db.user.count({ where }),
    ]);
    return {
      total,
      items: rows.map((u) => ({
        id: u.id, name: u.name, phoneMasked: maskPhone(u.phone), city: u.city?.name ?? null, status: u.status,
        isLister: u.isLister, idVerified: u.idVerified, listings: u._count.listings, createdAt: u.createdAt, lastSeenAt: u.lastSeenAt,
      })),
    };
  });

  app.get('/admin/users/:id', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const u = await deps.db.user.findUnique({
      where: { id },
      include: {
        city: true,
        listings: { where: { status: { not: 'REMOVED' } }, orderBy: { updatedAt: 'desc' }, take: 50, select: { id: true, title: true, status: true, viewCount: true, waClickCount: true, reportCount: true } },
        subscriptions: { orderBy: { createdAt: 'desc' }, take: 30 },
        payments: { orderBy: { createdAt: 'desc' }, take: 30 },
        reportsReceived: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, reason: true, status: true, createdAt: true, listingId: true } },
        deletion: true,
      },
    });
    if (!u) throw notFound();
    return {
      id: u.id, name: u.name, phoneMasked: maskPhone(u.phone), city: u.city?.name ?? null, cityId: u.cityId, status: u.status, blockReason: u.blockReason,
      isLister: u.isLister, idVerified: u.idVerified, language: u.language, createdAt: u.createdAt, lastSeenAt: u.lastSeenAt,
      deletion: u.deletion ? { requestedAt: u.deletion.requestedAt, dueAt: u.deletion.dueAt, completedAt: u.deletion.completedAt } : null,
      listings: u.listings,
      subscriptions: u.subscriptions.map((s) => ({ id: s.id, planName: s.planName, type: s.planType, status: s.status, startsAt: s.startsAt, endsAt: s.endsAt, source: s.source, assignReason: s.assignReason })),
      payments: u.payments.map((p) => ({ id: p.id, reference: p.shortRef, purpose: p.purpose, amountPaise: p.amountPaise, status: p.status, utrLast4: p.utr?.slice(-4) ?? null, createdAt: p.createdAt })),
      reports: u.reportsReceived,
    };
  });

  // Full number on demand, one person at a time, always logged.
  app.post('/admin/users/:id/reveal-phone', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const { why } = parse(z.object({ why: reason }).strict(), req.body);
    const u = await deps.db.user.findUnique({ where: { id }, select: { phone: true, status: true } });
    if (!u || u.status === 'DELETED') throw notFound();
    await audit(deps.db, actorOf(req), 'user.reveal_phone', 'User', id, null, { why });
    return { phone: u.phone };
  });

  app.post('/admin/users/:id/block', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const { reason: why } = parse(z.object({ reason }).strict(), req.body);
    const u = await deps.db.user.findUnique({ where: { id } });
    if (!u) throw notFound();
    if (u.status !== 'ACTIVE') throw badRequest('This account is not active', 'BAD_STATE');
    await blockUser(deps, id, why, actorOf(req));
    return { ok: true };
  });

  app.post('/admin/users/:id/unblock', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const { reason: why } = parse(z.object({ reason }).strict(), req.body);
    const u = await deps.db.user.findUnique({ where: { id } });
    if (!u || u.status !== 'BLOCKED') throw badRequest('This account is not blocked', 'BAD_STATE');
    await deps.db.user.update({ where: { id }, data: { status: 'ACTIVE', blockReason: null } });
    // Items come back as drafts; the lister re-submits what they still want live.
    await deps.db.listing.updateMany({ where: { userId: id, hiddenReason: 'BLOCKED' }, data: { status: 'DRAFT', hiddenReason: null } });
    await audit(deps.db, actorOf(req), 'user.unblock', 'User', id, { status: 'BLOCKED' }, { status: 'ACTIVE', reason: why });
    return { ok: true };
  });

  // Give plan (12.3). Paid plans for free = Super admin with a fresh 2-step code.
  app.post('/admin/users/:id/give-plan', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(z.object({ planId: z.uuid(), reason }).strict(), req.body);
    const [user, plan] = await Promise.all([deps.db.user.findUnique({ where: { id } }), deps.db.plan.findUnique({ where: { id: body.planId } })]);
    if (!user || user.status !== 'ACTIVE') throw notFound('User not found');
    if (!plan || plan.visibility === 'ARCHIVED') throw notFound('Plan not found');
    if (plan.pricePaise > 0) {
      if (req.admin!.role !== 'SUPER_ADMIN') throw forbidden('Only a Super admin can give a paid plan for free', 'SUPER_ADMIN_ONLY');
      await requireStepUp(req);
    }
    const sub = await deps.db.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: { userId: id, ...snapshot(plan), status: 'PENDING', source: 'admin', assignedById: req.admin!.id, assignReason: body.reason },
      });
      const started = await startSubscription(tx, created.id);
      await audit(tx, actorOf(req), 'subscription.give', 'Subscription', created.id, null, { userId: id, plan: plan.name, pricePaise: plan.pricePaise, reason: body.reason });
      return started;
    });
    await deps.notifier.toUser(id, 'PLAN_ACTIVATED', { plan: sub.planName, date: sub.endsAt!.toISOString().slice(0, 10) });
    return { ok: true, status: sub.status, endsAt: sub.endsAt };
  });

  app.post('/admin/subscriptions/:id/cancel', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const { reason: why } = parse(z.object({ reason }).strict(), req.body);
    const s = await deps.db.subscription.findUnique({ where: { id } });
    if (!s || !['ACTIVE', 'EXPIRING', 'SCHEDULED', 'PENDING'].includes(s.status)) throw badRequest('This plan cannot be cancelled', 'BAD_STATE');
    await deps.db.subscription.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: why, endsAt: new Date() } });
    await deps.jobs.enqueue('plan-expiry', {});
    await audit(deps.db, actorOf(req), 'subscription.cancel', 'Subscription', id, { status: s.status }, { status: 'CANCELLED', reason: why });
    return { ok: true };
  });
}
