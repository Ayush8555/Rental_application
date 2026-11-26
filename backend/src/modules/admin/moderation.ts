import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../../deps.ts';
import { actorOf, requireAdmin } from '../../plugins/admin-session.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import { maskPhone } from '../../lib/phone.ts';
import { parse } from '../../lib/validate.ts';
import { audit } from '../../services/audit.ts';
import type { Prisma } from '../../services/db.ts';
import { imageUrl } from '../serializers.ts';
import { listingCapacity } from '../subscription-state.ts';
import { revokeAllSessions } from '../auth.ts';
import { idParams, pageQuery, paging, reason } from './common.ts';

const listQuery = z
  .object({
    ...pageQuery,
    tab: z.enum(['review', 'all', 'hidden']).default('review'),
    q: z.string().trim().max(60).optional(),
    cityId: z.uuid().optional(),
  })
  .strict();

const actionBody = z
  .object({ action: z.enum(['approve', 'reject', 'hide', 'remove', 'restore']), reason: reason.optional() })
  .strict()
  .refine((b) => b.action === 'approve' || b.action === 'restore' || !!b.reason, { message: 'Reason is required', path: ['reason'] });

export async function blockUser(deps: Deps, userId: string, why: string, actor: ReturnType<typeof actorOf>) {
  const before = await deps.db.user.findUniqueOrThrow({ where: { id: userId } });
  await deps.db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status: 'BLOCKED', blockReason: why } });
    await tx.listing.updateMany({ where: { userId, status: { in: ['LIVE', 'REVIEW', 'RENTED_OUT'] } }, data: { status: 'HIDDEN', hiddenReason: 'BLOCKED' } });
    // Revoke now: the next request from any of their phones gets 401.
    await revokeAllSessions(tx, userId);
    await tx.deviceToken.deleteMany({ where: { userId } });
    await audit(tx, actor, 'user.block', 'User', userId, { status: before.status }, { status: 'BLOCKED', reason: why });
  });
}

export default async function adminModerationRoutes(app: FastifyInstance, deps: Deps) {
  // ------------------------------------------------------------ listings (W-06)

  app.get('/admin/listings', { preHandler: requireAdmin }, async (req) => {
    const q = parse(listQuery, req.query);
    const where: Prisma.ListingWhereInput = {
      status: q.tab === 'review' ? 'REVIEW' : q.tab === 'hidden' ? 'HIDDEN' : { not: 'REMOVED' },
      cityId: q.cityId,
      title: q.q ? { contains: q.q, mode: 'insensitive' } : undefined,
    };
    const [rows, total] = await Promise.all([
      deps.db.listing.findMany({
        where,
        orderBy: q.tab === 'review' ? { updatedAt: 'asc' } : { updatedAt: 'desc' },
        ...paging(q),
        include: { images: { orderBy: { sortOrder: 'asc' } }, category: true, area: true, city: true, user: { select: { id: true, name: true, phone: true, createdAt: true, idVerified: true } } },
      }),
      deps.db.listing.count({ where }),
    ]);
    const items = await Promise.all(
      rows.map(async (l) => ({
        id: l.id,
        shortId: l.shortId,
        // Plain strings. The admin UI renders them as text (never as HTML).
        title: l.title,
        description: l.description,
        status: l.status,
        hiddenReason: l.hiddenReason,
        rejectReason: l.rejectReason,
        category: l.category.name,
        place: `${l.area.name}, ${l.city.name}`,
        rentDayPaise: l.rentDayPaise,
        rentWeekPaise: l.rentWeekPaise,
        rentMonthPaise: l.rentMonthPaise,
        depositPaise: l.depositPaise,
        flags: l.moderationFlags,
        reportCount: l.reportCount,
        viewCount: l.viewCount,
        waClickCount: l.waClickCount,
        photos: await Promise.all(l.images.map((i) => imageUrl(deps.storage, i.storageKey))),
        lister: { id: l.user.id, name: l.user.name, phoneMasked: maskPhone(l.user.phone), since: l.user.createdAt, verified: l.user.idVerified },
        updatedAt: l.updatedAt,
      })),
    );
    return { items, total };
  });

  app.post('/admin/listings/:id/action', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(actionBody, req.body);
    const l = await deps.db.listing.findUnique({ where: { id } });
    if (!l) throw notFound();
    let data: Prisma.ListingUpdateInput;
    switch (body.action) {
      case 'approve': {
        if (l.status !== 'REVIEW') throw badRequest('Only items under review can be approved', 'BAD_STATE');
        const cap = await listingCapacity(deps.db, l.userId);
        // REVIEW items already hold a slot, so a plan is all we need here.
        data = cap.hasPlan
          ? { status: 'LIVE', publishedAt: l.publishedAt ?? new Date(), hiddenReason: null, rejectReason: null }
          : { status: 'DRAFT', hiddenReason: 'NEEDS_PLAN' };
        break;
      }
      case 'reject':
        if (l.status !== 'REVIEW') throw badRequest('Only items under review can be rejected', 'BAD_STATE');
        data = { status: 'DRAFT', rejectReason: body.reason!, hiddenReason: 'REJECTED' };
        break;
      case 'hide':
        data = { status: 'HIDDEN', hiddenReason: 'ADMIN', rejectReason: body.reason! };
        break;
      case 'remove':
        data = { status: 'REMOVED', deletedAt: new Date(), rejectReason: body.reason!, featuredUntil: null };
        break;
      case 'restore':
        if (l.status !== 'HIDDEN') throw badRequest('Only hidden items can be restored', 'BAD_STATE');
        data = { status: 'LIVE', hiddenReason: null, reportCount: 0 };
        break;
    }
    const after = await deps.db.listing.update({ where: { id }, data });
    if (body.action === 'restore') await deps.db.report.updateMany({ where: { listingId: id, status: 'OPEN' }, data: { status: 'DISMISSED', handledById: req.admin!.id, handledAt: new Date(), actionNote: 'restored' } });
    await audit(deps.db, actorOf(req), `listing.${body.action}`, 'Listing', id, { status: l.status }, { status: after.status, reason: body.reason });
    if (body.action === 'approve' && after.status === 'LIVE') await deps.notifier.toUser(l.userId, 'LISTING_APPROVED', { title: l.title }, { listingId: id });
    if (body.action === 'reject') await deps.notifier.toUser(l.userId, 'LISTING_REJECTED', { title: l.title, reason: body.reason! }, { listingId: id });
    if (body.action === 'hide') await deps.notifier.toUser(l.userId, 'LISTING_HIDDEN', { title: l.title }, { listingId: id });
    return { ok: true, status: after.status };
  });

  // ------------------------------------------------------------ reports (W-07)

  app.get('/admin/reports', { preHandler: requireAdmin }, async (req) => {
    const q = parse(z.object({ ...pageQuery, status: z.enum(['OPEN', 'ACTIONED', 'DISMISSED']).default('OPEN') }).strict(), req.query);
    const [rows, total] = await Promise.all([
      deps.db.report.findMany({
        where: { status: q.status },
        orderBy: { createdAt: q.status === 'OPEN' ? 'asc' : 'desc' },
        ...paging(q),
        include: {
          listing: { select: { id: true, title: true, status: true } },
          user: { select: { id: true, name: true, status: true } },
          reporter: { select: { phone: true } },
        },
      }),
      deps.db.report.count({ where: { status: q.status } }),
    ]);
    return {
      total,
      items: rows.map((r) => ({
        id: r.id,
        reason: r.reason,
        note: r.note,
        status: r.status,
        actionNote: r.actionNote,
        createdAt: r.createdAt,
        listing: r.listing,
        user: r.user,
        reporterMasked: maskPhone(r.reporter.phone),
      })),
    };
  });

  app.post('/admin/reports/:id/action', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(z.object({ action: z.enum(['remove_item', 'warn', 'block_user', 'dismiss']), note: reason }).strict(), req.body);
    const r = await deps.db.report.findUnique({ where: { id } });
    if (!r) throw notFound();
    if (r.status !== 'OPEN') throw badRequest('This report is already closed', 'CLOSED');
    const actor = actorOf(req);
    if (body.action === 'remove_item' && r.listingId) {
      await deps.db.listing.update({ where: { id: r.listingId }, data: { status: 'REMOVED', deletedAt: new Date(), rejectReason: body.note } });
    }
    if (body.action === 'block_user' && r.userId) await blockUser(deps, r.userId, body.note, actor);
    if (body.action === 'warn' && r.userId) {
      await deps.db.notification.create({ data: { userId: r.userId, type: 'WARNING', title: 'A note from RentNook', body: body.note.slice(0, 200) } });
    }
    // Close every open report on the same target together.
    await deps.db.report.updateMany({
      where: { targetKey: r.targetKey, status: 'OPEN' },
      data: { status: body.action === 'dismiss' ? 'DISMISSED' : 'ACTIONED', actionNote: `${body.action}: ${body.note}`, handledById: req.admin!.id, handledAt: new Date() },
    });
    await audit(deps.db, actor, `report.${body.action}`, 'Report', id, { status: 'OPEN' }, { action: body.action, note: body.note });
    return { ok: true };
  });
}
