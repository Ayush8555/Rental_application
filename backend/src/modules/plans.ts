import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { currentUser, makeAppCheckGuard, requireUser } from '../plugins/auth.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { badRequest, notFound, tooMany } from '../lib/errors.ts';
import { newPaymentRef } from '../lib/ids.ts';
import { paiseToUpiAmount } from '../lib/money.ts';
import { daysLeft } from '../lib/time.ts';
import { parse } from '../lib/validate.ts';
import type { Payment, Plan, Subscription, User } from '../services/db.ts';
import { getSetting, getSettings } from '../services/settings.ts';
import { assertEligible, checkCoupon, isFreePlan, planOnSale, snapshot, startBoost, startSubscription, timesTaken } from './billing.ts';
import { activeSubscription, listingCapacity } from './subscription-state.ts';

const subscribeBody = z
  .object({
    planId: z.uuid(),
    couponCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{4,20}$/).optional(),
  })
  .strict();

const boostBody = z.object({ days: z.number().int().min(1).max(60), useCredit: z.boolean().optional() }).strict();

function serializePlan(p: Plan, lang: 'en' | 'hi', used: number) {
  return {
    id: p.id,
    name: lang === 'hi' ? p.nameHi : p.name,
    nameEn: p.name,
    nameHi: p.nameHi,
    type: p.type,
    pricePaise: p.pricePaise,
    durationDays: p.durationDays,
    listingLimit: p.listingLimit,
    boostCredits: p.boostCredits,
    shopPage: p.shopPage,
    needsApproval: p.needsApproval,
    badge: lang === 'hi' ? (p.badgeHi ?? p.badge) : p.badge,
    points: lang === 'hi' && p.pointsHi.length ? p.pointsHi : p.points,
    alreadyUsed: p.maxPerUser !== null && used >= p.maxPerUser,
  };
}

export function serializeSubscription(s: Subscription) {
  return {
    id: s.id,
    planName: s.planName,
    planNameHi: s.planNameHi,
    type: s.planType,
    status: s.status,
    pricePaise: s.pricePaise,
    listingLimit: s.listingLimit,
    startsAt: s.startsAt?.toISOString() ?? null,
    endsAt: s.endsAt?.toISOString() ?? null,
    daysLeft: daysLeft(s.endsAt),
    boostCreditsLeft: s.boostCreditsLeft,
  };
}

// What the "Pay with UPI" screen needs. Every value comes from the server,
// so the app cannot change payee or amount.
export async function upiDetails(deps: Deps, p: Payment) {
  const upi = await getSetting(deps.db, 'upi');
  const params = new URLSearchParams({
    pa: upi.vpa,
    pn: upi.payeeName,
    am: paiseToUpiAmount(p.amountPaise),
    cu: 'INR',
    tn: p.shortRef,
  });
  return {
    payeeName: upi.payeeName,
    upiId: upi.vpa,
    amountPaise: p.amountPaise,
    reference: p.shortRef,
    upiLink: `upi://pay?${params.toString().replace(/\+/g, '%20')}`,
    qrUrl: upi.qrKey ? await deps.storage.signGet('photos', upi.qrKey, 900) : null,
  };
}

export function serializePayment(p: Payment & { subscription?: Subscription | null }) {
  return {
    id: p.id,
    reference: p.shortRef,
    purpose: p.purpose,
    status: p.status,
    listPricePaise: p.listPricePaise,
    discountPaise: p.discountPaise,
    amountPaise: p.amountPaise,
    utrLast4: p.utr ? p.utr.slice(-4) : null,
    rejectReason: p.rejectReason,
    submittedAt: p.submittedAt?.toISOString() ?? null,
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    planName: p.subscription?.planName ?? null,
  };
}

async function assertPendingRoom(deps: Deps, userId: string) {
  const { pendingPaymentsMax } = await getSetting(deps.db, 'limits');
  const pending = await deps.db.payment.count({ where: { userId, status: { in: ['CREATED', 'PENDING'] } } });
  if (pending >= pendingPaymentsMax) {
    throw tooMany('You already have payments waiting. Finish or wait for those first.', 'TOO_MANY_PENDING');
  }
}

async function createPayment(deps: Deps, user: User, data: { purpose: 'PLAN' | 'BOOST'; listPricePaise: number; discountPaise: number; couponId: string | null; subscriptionId?: string; boostId?: string }) {
  for (let i = 0; i < 5; i++) {
    try {
      return await deps.db.payment.create({
        data: {
          shortRef: newPaymentRef(),
          userId: user.id,
          purpose: data.purpose,
          refId: (data.subscriptionId ?? data.boostId)!,
          subscriptionId: data.subscriptionId,
          boostId: data.boostId,
          listPricePaise: data.listPricePaise,
          discountPaise: data.discountPaise,
          amountPaise: data.listPricePaise - data.discountPaise,
          couponId: data.couponId,
        },
      });
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err;
    }
  }
  throw new Error('could not allocate payment reference');
}

export default async function planRoutes(app: FastifyInstance, deps: Deps) {
  const appCheck = makeAppCheckGuard(deps);

  app.get('/plans', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const plans = await deps.db.plan.findMany({ where: { visibility: 'PUBLIC' }, orderBy: [{ sortOrder: 'asc' }, { pricePaise: 'asc' }] });
    const visible = plans.filter((p) => planOnSale(p, user.cityId));
    const items = await Promise.all(visible.map(async (p) => serializePlan(p, user.language, await timesTaken(deps.db, p, user.id, req.deviceId))));
    // Free and trial offers first (A-16), then paid.
    items.sort((a, b) => Number(a.pricePaise > 0) - Number(b.pricePaise > 0));
    return { items };
  });

  app.post('/coupons/validate', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'coupon-check', user.id, 20, 3600, 'Too many coupon tries. Please wait a while.');
    const body = parse(subscribeBody.required({ couponCode: true }), req.body);
    const plan = await deps.db.plan.findUnique({ where: { id: body.planId } });
    if (!plan || !planOnSale(plan, user.cityId)) throw notFound('Plan not found');
    const { discountPaise } = await checkCoupon(deps.db, body.couponCode, plan, user);
    return { discountPaise, totalPaise: plan.pricePaise - discountPaise };
  });

  app.post('/subscriptions', { preHandler: [requireUser, appCheck] }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'subscribe', user.id, 10, 3600);
    const body = parse(subscribeBody, req.body);
    const plan = await deps.db.plan.findUnique({ where: { id: body.planId } });
    if (!plan) throw notFound('Plan not found');

    if (isFreePlan(plan)) {
      if (body.couponCode) throw badRequest('Coupons are not needed on free plans', 'COUPON_INVALID');
      // Advisory lock per user+plan: two taps at the same time cannot both
      // pass the "used once" check.
      const sub = await deps.db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`free:${plan.id}:${req.deviceId ?? user.id}`}))`;
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`free:${plan.id}:${user.id}`}))`;
        await assertEligible(tx, plan, user, req.deviceId);
        const created = await tx.subscription.create({
          data: { userId: user.id, ...snapshot(plan), status: 'PENDING', deviceId: req.deviceId, source: 'app' },
        });
        if (plan.needsApproval) return created;
        return startSubscription(tx, created.id);
      });
      if (sub.status === 'PENDING') {
        await deps.notifier.toUser(user.id, 'PLAN_PENDING_APPROVAL', { plan: sub.planName });
      } else {
        await deps.notifier.toUser(user.id, 'PLAN_ACTIVATED', { plan: sub.planName, date: sub.endsAt!.toISOString().slice(0, 10) });
      }
      return { subscription: serializeSubscription(sub), payment: null };
    }

    await assertEligible(deps.db, plan, user, req.deviceId);
    await assertPendingRoom(deps, user.id);
    const coupon = body.couponCode ? await checkCoupon(deps.db, body.couponCode, plan, user) : null;

    // Amount is computed here from the plan and coupon; the app never sends it.
    const sub = await deps.db.subscription.create({
      data: { userId: user.id, ...snapshot(plan), status: 'PENDING', deviceId: req.deviceId, source: 'app' },
    });
    const payment = await createPayment(deps, user, {
      purpose: 'PLAN',
      listPricePaise: plan.pricePaise,
      discountPaise: coupon?.discountPaise ?? 0,
      couponId: coupon?.coupon.id ?? null,
      subscriptionId: sub.id,
    });
    return { subscription: serializeSubscription(sub), payment: { ...serializePayment(payment), upi: await upiDetails(deps, payment) } };
  });

  app.get('/subscriptions/mine', { preHandler: requireUser }, async (req) => {
    const rows = await deps.db.subscription.findMany({ where: { userId: currentUser(req).id }, orderBy: { createdAt: 'desc' }, take: 50 });
    return { items: rows.map(serializeSubscription) };
  });

  app.get('/me/lister-summary', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const [cap, counts, scheduled] = await Promise.all([
      listingCapacity(deps.db, user.id),
      deps.db.listing.aggregate({ where: { userId: user.id, status: { not: 'REMOVED' } }, _sum: { viewCount: true, waClickCount: true } }),
      deps.db.subscription.findFirst({ where: { userId: user.id, status: 'SCHEDULED' }, orderBy: { startsAt: 'asc' } }),
    ]);
    const byStatus = await deps.db.listing.groupBy({ by: ['status'], where: { userId: user.id, status: { not: 'REMOVED' } }, _count: true });
    const pendingPayments = await deps.db.payment.count({ where: { userId: user.id, status: 'PENDING' } });
    return {
      plan: cap.subscription ? serializeSubscription(cap.subscription) : null,
      nextPlan: scheduled ? serializeSubscription(scheduled) : null,
      limit: cap.limit,
      liveCount: cap.used,
      views: counts._sum.viewCount ?? 0,
      whatsappChats: counts._sum.waClickCount ?? 0,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      pendingPayments,
      rewardDaysBank: user.rewardDaysBank,
    };
  });

  // ------------------------------------------------------------ boosts (A-21)

  app.post('/listings/:id/boost', { preHandler: [requireUser, appCheck] }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'boost', user.id, 10, 3600);
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const body = parse(boostBody, req.body);
    const listing = await deps.db.listing.findFirst({ where: { id, userId: user.id } });
    if (!listing) throw notFound('Item not found');
    if (listing.status !== 'LIVE') throw badRequest('Only live items can be boosted', 'NOT_LIVE');
    const settings = await getSettings(deps.db);
    const option = settings.boostOptions.find((o) => o.days === body.days);
    if (!option) throw badRequest('Choose one of the boost options', 'BAD_OPTION');

    if (body.useCredit) {
      const result = await deps.db.$transaction(async (tx) => {
        const sub = await activeSubscription(tx, user.id);
        if (!sub) throw badRequest('You need an active plan to use boost credits', 'NEEDS_PLAN');
        // Conditional decrement: never goes below zero, even with parallel taps.
        const dec = await tx.subscription.updateMany({ where: { id: sub.id, boostCreditsLeft: { gt: 0 } }, data: { boostCreditsLeft: { decrement: 1 } } });
        if (dec.count !== 1) throw badRequest('No boost credits left this month', 'NO_CREDITS');
        const boost = await tx.boost.create({ data: { listingId: id, cityId: listing.cityId, userId: user.id, days: body.days, viaCredit: true } });
        return { boostId: boost.id, ...(await startBoost(tx, boost.id)) };
      });
      return { boost: { id: result.boostId, status: result.status, endsAt: result.endsAt?.toISOString() ?? null }, payment: null };
    }

    await assertPendingRoom(deps, user.id);
    const boost = await deps.db.boost.create({ data: { listingId: id, cityId: listing.cityId, userId: user.id, days: body.days } });
    const payment = await createPayment(deps, user, { purpose: 'BOOST', listPricePaise: option.pricePaise, discountPaise: 0, couponId: null, boostId: boost.id });
    return { boost: { id: boost.id, status: boost.status, endsAt: null }, payment: { ...serializePayment(payment), upi: await upiDetails(deps, payment) } };
  });
}
