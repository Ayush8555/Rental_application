import type { Db, Prisma } from '../services/db.ts';

type Reader = Db | Prisma.TransactionClient;

const LIVE_STATES = ['ACTIVE', 'EXPIRING'] as const;

export async function activeSubscription(db: Reader, userId: string, now = new Date()) {
  return db.subscription.findFirst({
    where: { userId, status: { in: [...LIVE_STATES] }, startsAt: { lte: now }, endsAt: { gt: now }, pausedAt: null },
    orderBy: { endsAt: 'desc' },
  });
}

// Items that take a plan slot: anything the public can see, plus items
// waiting in the review queue.
export const SLOT_STATUSES = ['LIVE', 'REVIEW', 'RENTED_OUT'] as const;

export async function listingCapacity(db: Reader, userId: string) {
  const sub = await activeSubscription(db, userId);
  const used = await db.listing.count({ where: { userId, status: { in: [...SLOT_STATUSES] } } });
  if (!sub) return { hasPlan: false, limit: 0, used, free: 0, subscription: null };
  const limit = sub.listingLimit;
  return {
    hasPlan: true,
    limit,
    used,
    free: limit === null ? Number.POSITIVE_INFINITY : Math.max(0, limit - used),
    subscription: sub,
  };
}

// When a plan ends or shrinks, the newest extra items go back to Draft so the
// count fits again. Returns ids that moved.
export async function trimToLimit(db: Reader, userId: string, limit: number | null) {
  if (limit === null) return [];
  const items = await db.listing.findMany({
    where: { userId, status: { in: [...SLOT_STATUSES] } },
    orderBy: [{ publishedAt: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  const extra = items.slice(limit).map((i) => i.id);
  if (extra.length) {
    await db.listing.updateMany({ where: { id: { in: extra } }, data: { status: 'DRAFT', hiddenReason: 'OVER_LIMIT' } });
  }
  return extra;
}
