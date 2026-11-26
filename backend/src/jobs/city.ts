import type { Deps } from '../deps.ts';

// Closing a city does not touch listing rows: every public query already
// filters on City.isOpen, so items vanish and come back exactly as they were.
// Plan days stop counting while the city is closed.

export async function closeCity(deps: Deps, cityId: string) {
  const now = new Date();
  return deps.db.$transaction(async (tx) => {
    const city = await tx.city.update({ where: { id: cityId }, data: { isOpen: false, closedAt: now } });
    await tx.subscription.updateMany({
      where: { status: { in: ['ACTIVE', 'EXPIRING'] }, pausedAt: null, user: { cityId } },
      data: { pausedAt: now },
    });
    return city;
  });
}

export async function openCity(deps: Deps, cityId: string) {
  const now = new Date();
  const city = await deps.db.$transaction(async (tx) => {
    const c = await tx.city.update({ where: { id: cityId }, data: { isOpen: true, openedAt: now, closedAt: null } });
    const paused = await tx.subscription.findMany({ where: { pausedAt: { not: null }, user: { cityId } } });
    for (const s of paused) {
      const pausedMs = now.getTime() - s.pausedAt!.getTime();
      await tx.subscription.update({
        where: { id: s.id },
        data: { pausedAt: null, endsAt: s.endsAt ? new Date(s.endsAt.getTime() + pausedMs) : null },
      });
    }
    return c;
  });
  await deps.jobs.enqueue('city-opened', { cityId });
  return city;
}

export async function notifyWaitlist(deps: Deps, cityId: string) {
  const city = await deps.db.city.findUnique({ where: { id: cityId } });
  if (!city?.isOpen) return 0;
  let sent = 0;
  for (;;) {
    const batch = await deps.db.cityWaitlist.findMany({ where: { cityId, notifiedAt: null }, take: 200 });
    if (!batch.length) break;
    for (const w of batch) {
      await deps.notifier.toUser(w.userId, 'CITY_OPENED', { city: city.name }, { cityId });
      sent++;
    }
    await deps.db.cityWaitlist.updateMany({ where: { cityId, userId: { in: batch.map((b) => b.userId) } }, data: { notifiedAt: new Date() } });
  }
  return sent;
}
