// The plan and payment engine (sections 12 and 13). Every function that moves
// money or grants access runs inside a database transaction and re-checks
// state there, because the app and even the admin panel can send the same
// request twice.

import type { Deps } from '../deps.ts';
import { badRequest, conflict, notFound } from '../lib/errors.ts';
import { addDays } from '../lib/time.ts';
import { audit, type AuditActor } from '../services/audit.ts';
import type { Coupon, Plan, Prisma, Subscription, User } from '../services/db.ts';
import { getSetting } from '../services/settings.ts';
import { activeSubscription, trimToLimit } from './subscription-state.ts';

type Tx = Prisma.TransactionClient;

// ---------------------------------------------------------------- visibility and eligibility

export function planOnSale(plan: Plan, cityId: string | null, now = new Date()) {
  if (plan.visibility !== 'PUBLIC') return false;
  if (plan.validFrom && plan.validFrom > now) return false;
  if (plan.validTo && plan.validTo < now) return false;
  if (!plan.allCities && (!cityId || !plan.cityIds.includes(cityId))) return false;
  return true;
}

export const isFreePlan = (plan: Pick<Plan, 'pricePaise' | 'type'>) => plan.pricePaise === 0;

// How many times this person (by account, and for free offers by phone
// device too) has already taken the plan. Rejected/cancelled tries do not count.
export async function timesTaken(db: Tx | Deps['db'], plan: Plan, userId: string, deviceId: string | null) {
  const countable = { notIn: ['REJECTED', 'CANCELLED'] as Array<'REJECTED' | 'CANCELLED'> };
  const or: Prisma.SubscriptionWhereInput[] = [{ userId }];
  if (deviceId && (plan.type === 'FREE' || plan.type === 'TRIAL')) or.push({ deviceId });
  return db.subscription.count({ where: { planId: plan.id, status: countable, OR: or } });
}

export async function assertEligible(db: Tx | Deps['db'], plan: Plan, user: User, deviceId: string | null) {
  if (!planOnSale(plan, user.cityId)) throw badRequest('This plan is not available', 'PLAN_UNAVAILABLE');
  // Free offers need a device id so "reinstall and try again" does not work.
  if ((plan.type === 'FREE' || plan.type === 'TRIAL') && !deviceId) {
    throw badRequest('Please update the app to use this offer', 'DEVICE_REQUIRED');
  }
  if (plan.maxPerUser !== null) {
    const n = await timesTaken(db, plan, user.id, deviceId);
    if (n >= plan.maxPerUser) throw conflict('You have already used this offer', 'ALREADY_USED');
  }
}

// ---------------------------------------------------------------- coupons

export interface CouponCheck {
  coupon: Coupon;
  discountPaise: number;
}

export function discountFor(coupon: Coupon, pricePaise: number) {
  const raw = coupon.type === 'PERCENT' ? Math.floor((pricePaise * coupon.value) / 100) : coupon.value;
  // Never below ₹1: a paid plan stays a payment we can match in the bank statement.
  return Math.min(raw, Math.max(0, pricePaise - 100));
}

export async function checkCoupon(db: Tx | Deps['db'], code: string, plan: Plan, user: User, excludePaymentId?: string): Promise<CouponCheck> {
  const coupon = await db.coupon.findUnique({ where: { code: code.toUpperCase() } });
  const now = new Date();
  const invalid = () => badRequest('This coupon is not valid', 'COUPON_INVALID');
  if (!coupon || !coupon.isActive) throw invalid();
  if (coupon.validFrom > now || coupon.validTo < now) throw badRequest('This coupon has expired', 'COUPON_EXPIRED');
  if (coupon.cityId && coupon.cityId !== user.cityId) throw invalid();
  if (coupon.planIds.length && !coupon.planIds.includes(plan.id)) throw badRequest('This coupon does not work on this plan', 'COUPON_WRONG_PLAN');
  if (isFreePlan(plan)) throw invalid();
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) throw badRequest('This coupon has been fully used', 'COUPON_USED_UP');
  const mine = await db.couponUse.count({ where: { couponId: coupon.id, userId: user.id } });
  // Pending payments also hold a use, so three tabs cannot share one coupon.
  const pending = await db.payment.count({
    where: { couponId: coupon.id, userId: user.id, status: { in: ['CREATED', 'PENDING'] }, id: excludePaymentId ? { not: excludePaymentId } : undefined },
  });
  if (mine + pending >= coupon.perUserLimit) throw badRequest('You have already used this coupon', 'COUPON_LIMIT');
  return { coupon, discountPaise: discountFor(coupon, plan.pricePaise) };
}

// ---------------------------------------------------------------- subscriptions

export function snapshot(plan: Plan) {
  return {
    planId: plan.id,
    planName: plan.name,
    planNameHi: plan.nameHi,
    planType: plan.type,
    pricePaise: plan.pricePaise,
    durationDays: plan.durationDays,
    listingLimit: plan.listingLimit,
    boostCredits: plan.boostCredits,
    shopPage: plan.shopPage,
  };
}

const capacityOf = (s: Pick<Subscription, 'listingLimit' | 'planType'>) =>
  s.listingLimit === null ? Number.POSITIVE_INFINITY : s.listingLimit + (s.planType === 'BUSINESS' ? 0.5 : 0);

// Starts (or schedules) a subscription that is already paid for or approved.
// Rules from 12.4: a bigger plan starts now and the old plan's remaining days
// go to the end; anything else queues behind the current plan.
export async function startSubscription(tx: Tx, subId: string, now = new Date()) {
  const sub = await tx.subscription.findUniqueOrThrow({ where: { id: subId } });
  if (sub.status !== 'PENDING') throw conflict('This plan was already handled', 'ALREADY_DONE');

  const user = await tx.user.findUniqueOrThrow({ where: { id: sub.userId } });
  const current = await activeSubscription(tx, sub.userId, now);
  const lastQueued = await tx.subscription.findFirst({
    where: { userId: sub.userId, status: 'SCHEDULED' },
    orderBy: { endsAt: 'desc' },
  });
  const bonus = user.rewardDaysBank;

  let startsAt: Date;
  let endsAt: Date;
  let status: 'ACTIVE' | 'SCHEDULED';
  if (current && capacityOf(sub) > capacityOf(current)) {
    const remainingMs = Math.max(0, current.endsAt!.getTime() - now.getTime());
    startsAt = now;
    endsAt = new Date(addDays(now, sub.durationDays + bonus).getTime() + remainingMs);
    status = 'ACTIVE';
    await tx.subscription.update({ where: { id: current.id }, data: { status: 'CANCELLED', cancelReason: 'UPGRADED', endsAt: now } });
  } else if (current) {
    startsAt = lastQueued?.endsAt ?? current.endsAt!;
    endsAt = addDays(startsAt, sub.durationDays + bonus);
    status = 'SCHEDULED';
  } else {
    startsAt = now;
    endsAt = addDays(now, sub.durationDays + bonus);
    status = 'ACTIVE';
  }

  const updated = await tx.subscription.update({
    where: { id: sub.id },
    data: { status, startsAt, endsAt, boostCreditsLeft: sub.boostCredits, boostCreditsResetAt: status === 'ACTIVE' ? now : null },
  });
  await tx.user.update({ where: { id: sub.userId }, data: { isLister: true, rewardDaysBank: 0 } });
  if (status === 'ACTIVE') await applyPlanToListings(tx, sub.userId, updated.listingLimit);
  return updated;
}

// After a plan becomes active: bring back items parked because the plan
// ended, up to the new limit, then trim anything over it.
export async function applyPlanToListings(tx: Tx, userId: string, limit: number | null) {
  const parked = await tx.listing.findMany({
    where: { userId, status: 'HIDDEN', hiddenReason: { in: ['PLAN_ENDED', 'OVER_LIMIT'] } },
    orderBy: { publishedAt: 'desc' },
    select: { id: true },
  });
  const used = await tx.listing.count({ where: { userId, status: { in: ['LIVE', 'REVIEW', 'RENTED_OUT'] } } });
  const room = limit === null ? parked.length : Math.max(0, limit - used);
  const back = parked.slice(0, room).map((p) => p.id);
  if (back.length) {
    await tx.listing.updateMany({ where: { id: { in: back } }, data: { status: 'LIVE', hiddenReason: null } });
  }
  await trimToLimit(tx, userId, limit);
}

// ---------------------------------------------------------------- boosts

export async function startBoost(tx: Tx, boostId: string, now = new Date()) {
  const boost = await tx.boost.findUniqueOrThrow({ where: { id: boostId } });
  if (boost.status !== 'AWAITING_PAYMENT') throw conflict('This boost was already handled', 'ALREADY_DONE');
  // Lock the city's boost rows so two approvals cannot both take the last slot.
  await tx.$queryRaw`SELECT id FROM "City" WHERE id = ${boost.cityId}::uuid FOR UPDATE`;
  const { sponsoredPerCity } = await getSetting(tx as unknown as Deps['db'], 'limits');
  const active = await tx.boost.count({ where: { cityId: boost.cityId, status: 'ACTIVE' } });
  if (active < sponsoredPerCity) {
    const endsAt = addDays(now, boost.days);
    await tx.boost.update({ where: { id: boost.id }, data: { status: 'ACTIVE', startsAt: now, endsAt } });
    const listing = await tx.listing.findUniqueOrThrow({ where: { id: boost.listingId } });
    const until = listing.featuredUntil && listing.featuredUntil > endsAt ? listing.featuredUntil : endsAt;
    await tx.listing.update({ where: { id: boost.listingId }, data: { featuredUntil: until } });
    return { status: 'ACTIVE' as const, endsAt };
  }
  await tx.boost.update({ where: { id: boost.id }, data: { status: 'QUEUED' } });
  return { status: 'QUEUED' as const, endsAt: null };
}

// ---------------------------------------------------------------- referral reward

async function rewardReferral(tx: Tx, refereeId: string, now: Date) {
  const ref = await tx.referral.findUnique({ where: { refereeId } });
  if (!ref || ref.status !== 'PENDING') return null;
  const settings = await getSetting(tx as unknown as Deps['db'], 'limits');
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const thisMonth = await tx.referral.count({ where: { referrerId: ref.referrerId, status: 'REWARDED', rewardedAt: { gte: monthStart } } });
  if (thisMonth >= settings.referralRewardsPerMonth) {
    await tx.referral.update({ where: { id: ref.id }, data: { status: 'CAPPED' } });
    return null;
  }
  const current = await activeSubscription(tx, ref.referrerId, now);
  if (current) {
    await tx.subscription.update({ where: { id: current.id }, data: { endsAt: addDays(current.endsAt!, ref.rewardDays) } });
  } else {
    await tx.user.update({ where: { id: ref.referrerId }, data: { rewardDaysBank: { increment: ref.rewardDays } } });
  }
  await tx.referral.update({ where: { id: ref.id }, data: { status: 'REWARDED', rewardedAt: now } });
  return { referrerId: ref.referrerId, days: ref.rewardDays };
}

// ---------------------------------------------------------------- admin decisions

export interface ApproveResult {
  paymentId: string;
  userId: string;
  purpose: 'PLAN' | 'BOOST';
  what: string;
  referral: { referrerId: string; days: number } | null;
  boost?: { status: 'ACTIVE' | 'QUEUED'; endsAt: Date | null; listingTitle: string };
}

export async function approvePayment(deps: Deps, paymentId: string, actor: AuditActor): Promise<ApproveResult> {
  const now = new Date();
  return deps.db.$transaction(
    async (tx) => {
      // Row lock: a second approve (double click, two admins) waits here and
      // then sees the status is no longer PENDING.
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Payment" WHERE id = ${paymentId}::uuid FOR UPDATE`;
      if (!locked.length) throw notFound('Payment not found');
      const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId }, include: { subscription: true, boost: { include: { listing: true } } } });
      if (p.status !== 'PENDING') throw conflict('This payment was already handled', 'ALREADY_DONE');
      if (!p.utr) throw badRequest('No UTR on this payment', 'NO_UTR');
      const dup = await tx.utrAttempt.findUnique({ where: { utr: p.utr } });
      if (dup && dup.paymentId !== p.id) throw conflict('This UTR belongs to another payment and cannot be approved', 'DUPLICATE_UTR');

      // Coupon is checked a second time, inside the lock.
      if (p.couponId) {
        await tx.$queryRaw`SELECT id FROM "Coupon" WHERE id = ${p.couponId}::uuid FOR UPDATE`;
        const coupon = await tx.coupon.findUniqueOrThrow({ where: { id: p.couponId } });
        const used = await tx.couponUse.count({ where: { couponId: coupon.id, userId: p.userId } });
        if (used >= coupon.perUserLimit) throw conflict('Coupon already used by this person. Reject and ask them to pay full price.', 'COUPON_LIMIT');
        const inc = await tx.coupon.updateMany({
          where: { id: coupon.id, isActive: true, OR: [{ maxUses: null }, { usedCount: { lt: coupon.maxUses ?? 0 } }] },
          data: { usedCount: { increment: 1 } },
        });
        if (inc.count !== 1) throw conflict('Coupon is fully used. Reject and ask them to pay full price.', 'COUPON_USED_UP');
        await tx.couponUse.create({ data: { couponId: coupon.id, userId: p.userId, paymentId: p.id } });
      }

      await tx.payment.update({
        where: { id: p.id },
        data: {
          status: 'APPROVED',
          reviewedById: actor.id,
          reviewedAt: now,
          rejectReason: null,
          screenshotDeleteAfter: addDays(now, 180),
        },
      });

      let what = 'plan';
      let boost: ApproveResult['boost'];
      if (p.purpose === 'PLAN' && p.subscriptionId) {
        const sub = await startSubscription(tx, p.subscriptionId, now);
        what = sub.planName;
      } else if (p.purpose === 'BOOST' && p.boostId) {
        const r = await startBoost(tx, p.boostId, now);
        what = 'boost';
        boost = { ...r, listingTitle: p.boost?.listing.title ?? '' };
      }

      const referral = p.purpose === 'PLAN' && p.amountPaise > 0 ? await rewardReferral(tx, p.userId, now) : null;
      await audit(tx, actor, 'payment.approve', 'Payment', p.id, { status: 'PENDING' }, { status: 'APPROVED', amountPaise: p.amountPaise, utr: p.utr });
      return { paymentId: p.id, userId: p.userId, purpose: p.purpose, what, referral, boost };
    },
    { isolationLevel: 'ReadCommitted', timeout: 15_000 },
  );
}

export async function rejectPayment(deps: Deps, paymentId: string, reason: string, actor: AuditActor) {
  return deps.db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "Payment" WHERE id = ${paymentId}::uuid FOR UPDATE`;
    if (!locked.length) throw notFound('Payment not found');
    const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
    if (p.status !== 'PENDING') throw conflict('This payment was already handled', 'ALREADY_DONE');
    // utr is cleared from the payment (so the user can resubmit a corrected
    // one) but stays in UtrAttempt, so nobody else can ever use it.
    await tx.payment.update({
      where: { id: p.id },
      data: { status: 'REJECTED', rejectReason: reason, reviewedById: actor.id, reviewedAt: new Date(), utr: null, screenshotDeleteAfter: addDays(new Date(), 180) },
    });
    await audit(tx, actor, 'payment.reject', 'Payment', p.id, { status: 'PENDING', utr: p.utr }, { status: 'REJECTED', reason });
    return p;
  });
}
