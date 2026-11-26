// Background work. Every handler is idempotent: running it twice, or after a
// restart that missed a few runs, gives the same result as running it once.

import type { Deps } from '../deps.ts';
import { addDays, DAY_MS, istDay } from '../lib/time.ts';
import { audit } from '../services/audit.ts';
import { applyPlanToListings } from '../modules/billing.ts';
import { activeSubscription } from '../modules/subscription-state.ts';
import { audienceWhere } from '../modules/admin/ops.ts';
import { notifyWaitlist } from './city.ts';
import type { JobName } from './queue.ts';

const REMINDER_DAYS = [7, 3, 1];
const SYSTEM = { id: null, type: 'system' as const };

// ---------------------------------------------------------------- plans (12.4)

export async function runPlanExpiry(deps: Deps, now = new Date()) {
  const { db } = deps;
  const stats = { expired: 0, started: 0, reminders: 0, hiddenFor: 0, creditsReset: 0 };

  // 1. End plans whose time is up (paused ones are frozen and skipped).
  const ending = await db.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'EXPIRING'] }, endsAt: { lte: now }, pausedAt: null },
    select: { id: true, userId: true },
  });
  for (const s of ending) {
    const res = await db.subscription.updateMany({ where: { id: s.id, status: { in: ['ACTIVE', 'EXPIRING'] } }, data: { status: 'EXPIRED' } });
    stats.expired += res.count;
  }

  // 2. Start queued plans whose turn has come.
  const due = await db.subscription.findMany({ where: { status: 'SCHEDULED', startsAt: { lte: now } }, orderBy: { startsAt: 'asc' } });
  for (const s of due) {
    await db.$transaction(async (tx) => {
      const res = await tx.subscription.updateMany({ where: { id: s.id, status: 'SCHEDULED' }, data: { status: 'ACTIVE', boostCreditsLeft: s.boostCredits, boostCreditsResetAt: now } });
      if (res.count === 1) {
        await applyPlanToListings(tx, s.userId, s.listingLimit);
        stats.started++;
      }
    });
  }

  // 3. Users whose plan ended and nothing took over: hide their items.
  for (const userId of new Set(ending.map((e) => e.userId))) {
    const still = await activeSubscription(db, userId, now);
    if (still) {
      await db.$transaction((tx) => applyPlanToListings(tx, userId, still.listingLimit));
      continue;
    }
    const hidden = await db.listing.updateMany({
      where: { userId, status: { in: ['LIVE', 'REVIEW', 'RENTED_OUT'] } },
      data: { status: 'HIDDEN', hiddenReason: 'PLAN_ENDED', featuredUntil: null },
    });
    if (hidden.count) stats.hiddenFor++;
    await deps.notifier.toUser(userId, 'PLAN_EXPIRED', {});
  }

  // 4. Reminders 7/3/1 days before the end. remindersSent makes it once-only.
  const soon = await db.subscription.findMany({
    where: { status: { in: ['ACTIVE', 'EXPIRING'] }, pausedAt: null, endsAt: { gt: now, lte: addDays(now, 7) } },
  });
  for (const s of soon) {
    const left = Math.ceil((s.endsAt!.getTime() - now.getTime()) / DAY_MS);
    // The tightest bucket we are in: 7..4 days -> 7, 3..2 -> 3, 1 -> 1. After a
    // missed run we send only the current one, never a burst of old ones.
    const mark = [...REMINDER_DAYS].sort((a, b) => a - b).find((d) => left <= d);
    if (s.status === 'ACTIVE') await db.subscription.update({ where: { id: s.id }, data: { status: 'EXPIRING' } });
    if (mark === undefined || s.remindersSent.includes(mark)) continue;
    // A queued next plan means there is nothing to remind about.
    const next = await db.subscription.count({ where: { userId: s.userId, status: 'SCHEDULED' } });
    const claim = await db.subscription.updateMany({
      where: { id: s.id, NOT: { remindersSent: { has: mark } } },
      data: { remindersSent: { push: mark } },
    });
    if (claim.count === 1 && !next) {
      await deps.notifier.toUser(s.userId, 'PLAN_EXPIRING', { days: left, plan: s.planName });
      stats.reminders++;
    }
  }

  // 5. Monthly boost credits.
  const reset = await db.subscription.updateMany({
    where: { status: { in: ['ACTIVE', 'EXPIRING'] }, boostCredits: { gt: 0 }, boostCreditsResetAt: { lte: addDays(now, -30) } },
    data: { boostCreditsResetAt: now },
  });
  if (reset.count) {
    await db.$executeRaw`UPDATE "Subscription" SET "boostCreditsLeft" = "boostCredits" WHERE "boostCreditsResetAt" = ${now}`;
    stats.creditsReset = reset.count;
  }
  return stats;
}

// ---------------------------------------------------------------- boosts

export async function runBoosts(deps: Deps, now = new Date()) {
  const { db } = deps;
  const ended = await db.boost.updateMany({ where: { status: 'ACTIVE', endsAt: { lte: now } }, data: { status: 'ENDED' } });
  await db.listing.updateMany({ where: { featuredUntil: { lte: now } }, data: { featuredUntil: null } });

  const { sponsoredPerCity } = await import('../services/settings.ts').then((m) => m.getSetting(db, 'limits'));
  const cities = await db.boost.groupBy({ by: ['cityId'], where: { status: 'QUEUED' } });
  let started = 0;
  for (const { cityId } of cities) {
    await db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "City" WHERE id = ${cityId}::uuid FOR UPDATE`;
      const active = await tx.boost.count({ where: { cityId, status: 'ACTIVE' } });
      const room = sponsoredPerCity - active;
      if (room <= 0) return;
      const queued = await tx.boost.findMany({ where: { cityId, status: 'QUEUED' }, orderBy: { createdAt: 'asc' }, take: room, include: { listing: true } });
      for (const b of queued) {
        if (b.listing.status !== 'LIVE') {
          // Item went away while waiting; give the slot to the next one.
          continue;
        }
        const endsAt = addDays(now, b.days);
        await tx.boost.update({ where: { id: b.id }, data: { status: 'ACTIVE', startsAt: now, endsAt } });
        await tx.listing.update({ where: { id: b.listingId }, data: { featuredUntil: endsAt } });
        started++;
      }
    });
  }
  return { ended: ended.count, started };
}

// ---------------------------------------------------------------- payments

export async function runPaymentsCleanup(deps: Deps, now = new Date()) {
  // Payments created but never paid (no UTR within 24 h) are dropped so they
  // stop counting towards the "3 pending" limit.
  const stale = await deps.db.payment.findMany({ where: { status: 'CREATED', createdAt: { lte: addDays(now, -1) } } });
  for (const p of stale) {
    await deps.db.$transaction(async (tx) => {
      const res = await tx.payment.updateMany({ where: { id: p.id, status: 'CREATED' }, data: { status: 'CANCELLED' } });
      if (res.count !== 1) return;
      if (p.subscriptionId) await tx.subscription.updateMany({ where: { id: p.subscriptionId, status: 'PENDING' }, data: { status: 'CANCELLED', cancelReason: 'NOT_PAID' } });
      if (p.boostId) await tx.boost.updateMany({ where: { id: p.boostId, status: 'AWAITING_PAYMENT' }, data: { status: 'CANCELLED' } });
    });
  }
  return { cancelled: stale.length };
}

// ---------------------------------------------------------------- account deletion (P4-01)

export async function runAccountDeletion(deps: Deps, now = new Date()) {
  const { db, storage } = deps;
  // A one-day grace period lets support undo a mistaken request; the hard
  // limit from the Privacy Policy is 7 days.
  const due = await db.deletionRequest.findMany({
    where: { completedAt: null, OR: [{ requestedAt: { lte: addDays(now, -1) } }, { dueAt: { lte: now } }] },
    take: 50,
  });
  let done = 0;
  for (const r of due) {
    const userId = r.userId;
    const images = await db.listingImage.findMany({ where: { listing: { userId } }, select: { storageKey: true } });
    const shop = await db.shopProfile.findUnique({ where: { userId } });
    const ids = await db.idVerification.findMany({ where: { userId, docKey: { not: null } } });
    const proofs = await db.payment.findMany({ where: { userId, screenshotKey: { not: null } }, select: { screenshotKey: true } });
    const uploads = await db.upload.findMany({ where: { userId } });

    // Files first. If the job dies half way it simply runs again tomorrow.
    for (const i of images) await storage.remove('photos', i.storageKey).catch(() => undefined);
    if (shop?.logoKey) await storage.remove('photos', shop.logoKey).catch(() => undefined);
    for (const d of ids) await storage.remove('private', d.docKey!).catch(() => undefined);
    for (const p of proofs) await storage.remove('private', p.screenshotKey!).catch(() => undefined);
    for (const u of uploads) {
      await storage.remove('private', u.rawKey).catch(() => undefined);
      if (u.finalKey) await storage.remove(u.purpose === 'proof' || u.purpose === 'id' ? 'private' : 'photos', u.finalKey).catch(() => undefined);
    }

    await db.$transaction(async (tx) => {
      await tx.listingImage.deleteMany({ where: { listing: { userId } } });
      await tx.listing.updateMany({
        where: { userId },
        data: { status: 'REMOVED', title: 'Removed', description: '', extra: {}, whatsappPhone: null, deletedAt: now, featuredUntil: null },
      });
      await tx.favorite.deleteMany({ where: { userId } });
      await tx.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } });
      await tx.deviceToken.deleteMany({ where: { userId } });
      await tx.session.deleteMany({ where: { userId } });
      await tx.notification.deleteMany({ where: { userId } });
      await tx.cityWaitlist.deleteMany({ where: { userId } });
      await tx.itemRequest.deleteMany({ where: { userId } });
      await tx.shopProfile.deleteMany({ where: { userId } });
      await tx.idVerification.deleteMany({ where: { userId } });
      await tx.upload.deleteMany({ where: { userId } });
      await tx.contactEvent.deleteMany({ where: { OR: [{ seekerId: userId }, { ownerId: userId }] } });
      await tx.report.updateMany({ where: { reporterId: userId }, data: { note: null } });
      // Payments stay for tax records, without the screenshot.
      await tx.payment.updateMany({ where: { userId }, data: { screenshotKey: null, anonymised: true } });
      await tx.user.update({
        where: { id: userId },
        data: {
          phone: `deleted:${userId}`, // frees the number for a brand-new account
          name: null,
          cityId: null,
          blockReason: null,
          idVerified: false,
          isLister: false,
          referralCode: `X${userId.replace(/-/g, '').slice(0, 9).toUpperCase()}`,
          status: 'DELETED',
        },
      });
      await tx.deletionRequest.update({ where: { id: r.id }, data: { completedAt: now, reason: null } });
      await audit(tx, SYSTEM, 'user.deleted', 'User', userId);
    });
    done++;
  }
  return { deleted: done };
}

// ---------------------------------------------------------------- retention (section 21)

export async function runRetention(deps: Deps, now = new Date()) {
  const { db, storage } = deps;
  const proofs = await db.payment.findMany({ where: { screenshotKey: { not: null }, screenshotDeleteAfter: { lte: now } }, take: 500 });
  for (const p of proofs) {
    await storage.remove('private', p.screenshotKey!).catch(() => undefined);
    await db.payment.update({ where: { id: p.id }, data: { screenshotKey: null } });
  }
  const docs = await db.idVerification.findMany({ where: { docKey: { not: null }, deleteAfter: { lte: now } }, take: 500 });
  for (const d of docs) {
    await storage.remove('private', d.docKey!).catch(() => undefined);
    await db.idVerification.update({ where: { id: d.id }, data: { docKey: null, docDeletedAt: now } });
  }
  const orphans = await db.upload.findMany({ where: { status: { in: ['SIGNED', 'READY', 'REJECTED'] }, expiresAt: { lte: now } }, take: 1000 });
  for (const u of orphans) {
    await storage.remove('private', u.rawKey).catch(() => undefined);
    if (u.finalKey) await storage.remove(u.purpose === 'proof' || u.purpose === 'id' ? 'private' : 'photos', u.finalKey).catch(() => undefined);
  }
  await db.upload.deleteMany({ where: { id: { in: orphans.map((o) => o.id) } } });
  const searches = await db.searchLog.deleteMany({ where: { createdAt: { lte: addDays(now, -365) } } });
  await db.session.deleteMany({ where: { OR: [{ expiresAt: { lte: addDays(now, -7) } }, { revokedAt: { lte: addDays(now, -30) } }] } });
  await db.adminSession.deleteMany({ where: { expiresAt: { lte: addDays(now, -30) } } });
  await db.notification.deleteMany({ where: { createdAt: { lte: addDays(now, -180) } } });
  await db.contactEvent.deleteMany({ where: { createdAt: { lte: addDays(now, -400) } } });
  return { proofs: proofs.length, idDocs: docs.length, uploads: orphans.length, searchLogs: searches.count };
}

export async function runRequestsAutoclose(deps: Deps) {
  const today = new Date(istDay());
  const res = await deps.db.itemRequest.updateMany({ where: { status: 'OPEN', toDate: { lt: today } }, data: { status: 'CLOSED' } });
  return { closed: res.count };
}

// ---------------------------------------------------------------- broadcasts

export async function runBroadcast(deps: Deps, broadcastId: string) {
  const b = await deps.db.broadcast.findUnique({ where: { id: broadcastId } });
  if (!b || b.status !== 'QUEUED') return { sent: 0 };
  await deps.db.broadcast.update({ where: { id: b.id }, data: { status: 'SENDING' } });
  let cursor: string | undefined;
  let sent = 0;
  for (;;) {
    const users = await deps.db.user.findMany({
      where: audienceWhere(b.audience as 'all' | 'city' | 'listers', b.cityId),
      select: { id: true, deviceTokens: { select: { fcmToken: true } } },
      orderBy: { id: 'asc' },
      take: 250,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!users.length) break;
    cursor = users[users.length - 1]!.id;
    await deps.db.notification.createMany({ data: users.map((u) => ({ userId: u.id, type: 'BROADCAST', title: b.title, body: b.body })) });
    sent += await deps.notifier.sendPush(users.flatMap((u) => u.deviceTokens.map((d) => d.fcmToken)), { title: b.title, body: b.body, data: { type: 'BROADCAST' } });
  }
  await deps.db.broadcast.update({ where: { id: b.id }, data: { status: 'DONE', sentCount: sent, finishedAt: new Date() } });
  return { sent };
}

// ---------------------------------------------------------------- daily approvals summary for Super admin

export async function runDailySummary(deps: Deps, now = new Date()) {
  const since = addDays(now, -1);
  const rows = await deps.db.payment.groupBy({ by: ['reviewedById', 'status'], where: { reviewedAt: { gte: since }, status: { in: ['APPROVED', 'REJECTED'] } }, _count: true, _sum: { amountPaise: true } });
  const summary = rows.map((r) => ({ adminId: r.reviewedById, status: r.status, count: r._count, amountPaise: r._sum.amountPaise ?? 0 }));
  await audit(deps.db, SYSTEM, 'summary.daily_payments', 'Payment', null, null, { day: istDay(since), summary });
  return { rows: summary.length };
}

export function makeRunner(deps: Deps) {
  return async (name: JobName, data: Record<string, unknown>) => {
    switch (name) {
      case 'plan-expiry':
        return runPlanExpiry(deps);
      case 'boosts':
        return runBoosts(deps);
      case 'payments-cleanup':
        return runPaymentsCleanup(deps);
      case 'account-deletion':
        return runAccountDeletion(deps);
      case 'retention':
        return runRetention(deps);
      case 'requests-autoclose':
        return runRequestsAutoclose(deps);
      case 'broadcast':
        return runBroadcast(deps, String(data.broadcastId));
      case 'city-opened':
        return notifyWaitlist(deps, String(data.cityId));
      case 'daily-summary':
        return runDailySummary(deps);
    }
  };
}

// cron, server time zone set to Asia/Kolkata in the worker.
export const SCHEDULES: Array<{ name: JobName; pattern: string }> = [
  { name: 'plan-expiry', pattern: '*/15 * * * *' },
  { name: 'boosts', pattern: '*/15 * * * *' },
  { name: 'payments-cleanup', pattern: '7 * * * *' },
  { name: 'account-deletion', pattern: '20 3 * * *' },
  { name: 'retention', pattern: '40 3 * * *' },
  { name: 'requests-autoclose', pattern: '5 0 * * *' },
  { name: 'daily-summary', pattern: '0 9 * * *' },
];
