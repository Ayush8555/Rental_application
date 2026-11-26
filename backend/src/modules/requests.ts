import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { currentUser, requireUser } from '../plugins/auth.ts';
import { badRequest, forbidden, notFound, tooMany } from '../lib/errors.ts';
import { activeSubscription } from './subscription-state.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { makeAppCheckGuard } from '../plugins/auth.ts';
import { cleanListingText } from '../lib/text-filter.ts';
import { startOfIstDay, istDay } from '../lib/time.ts';
import { parse } from '../lib/validate.ts';
import { getSetting } from '../services/settings.ts';

const body = z
  .object({
    text: z.string().trim().min(10).max(200),
    categoryId: z.uuid(),
    fromDate: z.iso.date(),
    toDate: z.iso.date(),
  })
  .strict();

const MAX_NOTIFY = 200;

export default async function requestRoutes(app: FastifyInstance, deps: Deps) {
  app.post('/requests', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const input = parse(body, req.body);
    if (!user.cityId) throw badRequest('Choose your city first', 'NO_CITY');
    const today = istDay();
    if (input.fromDate < today) throw badRequest('Start date cannot be in the past', 'BAD_DATES');
    if (input.toDate < input.fromDate) throw badRequest('End date must be after the start date', 'BAD_DATES');
    const limits = await getSetting(deps.db, 'limits');
    const made = await deps.db.itemRequest.count({ where: { userId: user.id, createdAt: { gte: startOfIstDay() } } });
    if (made >= limits.requestsPerDay) throw tooMany('You can post 5 requests a day. Please try tomorrow.', 'REQUEST_LIMIT');
    const category = await deps.db.category.findFirst({ where: { id: input.categoryId, isActive: true } });
    if (!category) throw badRequest('Choose a category', 'BAD_CATEGORY');

    const text = cleanListingText(input.text).text;
    const request = await deps.db.itemRequest.create({
      data: { userId: user.id, cityId: user.cityId, categoryId: category.id, text, fromDate: new Date(input.fromDate), toDate: new Date(input.toDate) },
    });

    // Listers in this city with a live item in this category and an active plan.
    const now = new Date();
    const listers = await deps.db.user.findMany({
      where: {
        id: { not: user.id },
        status: 'ACTIVE',
        cityId: user.cityId,
        listings: { some: { categoryId: category.id, status: 'LIVE' } },
        subscriptions: { some: { status: { in: ['ACTIVE', 'EXPIRING'] }, endsAt: { gt: now } } },
        blocksMade: { none: { blockedId: user.id } },
        blocksReceived: { none: { blockerId: user.id } },
      },
      select: { id: true },
      take: MAX_NOTIFY,
    });
    for (const l of listers) {
      await deps.notifier.toUser(l.id, 'ITEM_REQUEST', { text: text.slice(0, 40), category: category.name }, { requestId: request.id });
    }
    await deps.db.itemRequest.update({ where: { id: request.id }, data: { notifiedCount: listers.length } });
    return { id: request.id, notified: listers.length };
  });

  app.get('/requests/mine', { preHandler: requireUser }, async (req) => {
    const rows = await deps.db.itemRequest.findMany({
      where: { userId: currentUser(req).id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { category: true },
    });
    return {
      items: rows.map((r) => ({
        id: r.id,
        text: r.text,
        category: { id: r.category.id, name: r.category.name, nameHi: r.category.nameHi },
        fromDate: r.fromDate.toISOString().slice(0, 10),
        toDate: r.toDate.toISOString().slice(0, 10),
        status: r.status,
        notifiedCount: r.notifiedCount,
        createdAt: r.createdAt,
      })),
    };
  });

  // A lister who got the push opens the request and replies on WhatsApp.
  // Same rules as contacting an owner: signed in, App Check, daily limit.
  async function loadForLister(userId: string, cityId: string | null, id: string) {
    const r = await deps.db.itemRequest.findUnique({ where: { id }, include: { category: true, user: { select: { id: true, phone: true, name: true, status: true } } } });
    if (!r || r.status !== 'OPEN' || r.user.status !== 'ACTIVE' || r.cityId !== cityId) throw notFound('This request is closed');
    if (r.userId === userId) throw badRequest('This is your own request');
    if (!(await activeSubscription(deps.db, userId))) throw forbidden('Only listers with an active plan can reply to requests', 'NEEDS_PLAN');
    const block = await deps.db.block.findFirst({ where: { OR: [{ blockerId: userId, blockedId: r.userId }, { blockerId: r.userId, blockedId: userId }] } });
    if (block) throw notFound('This request is closed');
    return r;
  }

  app.get('/requests/:id', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const r = await loadForLister(user.id, user.cityId, id);
    return {
      id: r.id,
      text: r.text,
      category: { id: r.category.id, name: r.category.name, nameHi: r.category.nameHi },
      fromDate: r.fromDate.toISOString().slice(0, 10),
      toDate: r.toDate.toISOString().slice(0, 10),
      firstName: (r.user.name ?? '').split(' ')[0] || 'Someone',
    };
  });

  app.post('/requests/:id/contact', { preHandler: [requireUser, makeAppCheckGuard(deps)] }, async (req) => {
    const user = currentUser(req);
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const r = await loadForLister(user.id, user.cityId, id);
    const { contactsPerDay } = await getSetting(deps.db, 'limits');
    await enforceLimit(deps, `req-contact:${istDay()}`, user.id, contactsPerDay, 26 * 3600, 'You have contacted many people today. Try again tomorrow.');
    const text = `Hi, I saw your request on RentNook for "${r.text.slice(0, 60)}". I have this on rent.`;
    return { whatsappUrl: `https://wa.me/${r.user.phone.replace('+', '')}?text=${encodeURIComponent(text)}` };
  });
}
