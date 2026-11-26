import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { currentUser, requireUser } from '../plugins/auth.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { clampLimit, decodeCursor, encodeCursor } from '../lib/cursor.ts';
import { badRequest, conflict, notFound } from '../lib/errors.ts';
import { stripHtml } from '../lib/text-filter.ts';
import { parse } from '../lib/validate.ts';
import { Prisma } from '../services/db.ts';
import { getSetting } from '../services/settings.ts';
import { cardInclude, serializeCard } from './serializers.ts';

const idParam = z.object({ listingId: z.uuid() }).strict();
const userParam = z.object({ userId: z.uuid() }).strict();

const reportBody = z
  .object({
    listingId: z.uuid().optional(),
    userId: z.uuid().optional(),
    reason: z.enum(['FAKE_ITEM', 'ADVANCE_PAYMENT', 'WRONG_PRICE', 'OFFENSIVE', 'OTHER']),
    note: z.string().trim().max(300).optional(),
  })
  .strict()
  .refine((b) => !!b.listingId !== !!b.userId, 'Report either an item or a person');

const isDup = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

export default async function engagementRoutes(app: FastifyInstance, deps: Deps) {
  // ------------------------------------------------------------ favourites

  app.get('/favorites', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const q = parse(z.object({ cursor: z.string().max(200).optional(), limit: z.coerce.number().int().optional() }).strict(), req.query);
    const take = clampLimit(q.limit);
    const offset = decodeCursor(q.cursor);
    const rows = await deps.db.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: take + 1,
      include: { listing: { include: { ...cardInclude, city: true } } },
    });
    const items = await Promise.all(
      rows.slice(0, take).map(async (f) => ({
        ...(await serializeCard(deps.storage, f.listing, { saved: true })),
        available: f.listing.status === 'LIVE' && f.listing.city.isOpen,
      })),
    );
    return { items, nextCursor: rows.length > take ? encodeCursor(offset + take) : null };
  });

  app.post('/favorites/:listingId', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'fav', user.id, 120, 3600);
    const { listingId } = parse(idParam, req.params);
    const l = await deps.db.listing.findFirst({ where: { id: listingId, status: { in: ['LIVE', 'RENTED_OUT'] } } });
    if (!l) throw notFound('This item is no longer available');
    const count = await deps.db.favorite.count({ where: { userId: user.id } });
    if (count >= 500) throw badRequest('Your saved list is full. Remove a few items first.', 'FAVORITES_FULL');
    try {
      await deps.db.favorite.create({ data: { userId: user.id, listingId } });
    } catch (err) {
      if (!isDup(err)) throw err;
    }
    return { ok: true };
  });

  app.delete('/favorites/:listingId', { preHandler: requireUser }, async (req) => {
    const { listingId } = parse(idParam, req.params);
    await deps.db.favorite.deleteMany({ where: { userId: currentUser(req).id, listingId } });
    return { ok: true };
  });

  // ------------------------------------------------------------ reports (A-13)

  app.post('/reports', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'report', user.id, 10, 24 * 3600, 'You have sent many reports today. Thanks — we are looking at them.');
    const body = parse(reportBody, req.body);
    let ownerId: string;
    let targetKey: string;
    if (body.listingId) {
      const l = await deps.db.listing.findUnique({ where: { id: body.listingId } });
      if (!l || l.status === 'REMOVED') throw notFound('Item not found');
      if (l.userId === user.id) throw badRequest('You cannot report your own item');
      ownerId = l.userId;
      targetKey = `listing:${l.id}`;
    } else {
      const target = await deps.db.user.findUnique({ where: { id: body.userId! } });
      if (!target || target.status === 'DELETED') throw notFound('Person not found');
      if (target.id === user.id) throw badRequest('You cannot report yourself');
      ownerId = target.id;
      targetKey = `user:${target.id}`;
    }

    try {
      await deps.db.report.create({
        data: {
          reporterId: user.id,
          listingId: body.listingId ?? null,
          userId: body.listingId ? ownerId : body.userId!,
          targetKey,
          reason: body.reason,
          note: body.note ? stripHtml(body.note) : null,
        },
      });
    } catch (err) {
      if (isDup(err)) throw conflict('You have already reported this', 'ALREADY_REPORTED');
      throw err;
    }

    if (body.listingId) {
      // Counted from distinct open reports, so one angry person cannot hide an item.
      const reporters = await deps.db.report.count({ where: { listingId: body.listingId, status: 'OPEN' } });
      const { reportsToHide } = await getSetting(deps.db, 'limits');
      const updated = await deps.db.listing.update({ where: { id: body.listingId }, data: { reportCount: reporters } });
      if (reporters >= reportsToHide && updated.status === 'LIVE') {
        await deps.db.listing.update({ where: { id: body.listingId }, data: { status: 'HIDDEN', hiddenReason: 'REPORTS' } });
        await deps.notifier.toUser(updated.userId, 'LISTING_HIDDEN', { title: updated.title }, { listingId: updated.id });
      }
    }
    return { ok: true, message: 'Thanks for telling us. We will check it.' };
  });

  // ------------------------------------------------------------ blocks

  app.post('/blocks/:userId', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'block', user.id, 30, 24 * 3600);
    const { userId } = parse(userParam, req.params);
    if (userId === user.id) throw badRequest('You cannot block yourself');
    const target = await deps.db.user.findUnique({ where: { id: userId } });
    if (!target) throw notFound('Person not found');
    try {
      await deps.db.block.create({ data: { blockerId: user.id, blockedId: userId } });
    } catch (err) {
      if (!isDup(err)) throw err;
    }
    return { ok: true };
  });

  app.delete('/blocks/:userId', { preHandler: requireUser }, async (req) => {
    const { userId } = parse(userParam, req.params);
    await deps.db.block.deleteMany({ where: { blockerId: currentUser(req).id, blockedId: userId } });
    return { ok: true };
  });
}
