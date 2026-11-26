const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

// Calendar day in India, e.g. "2026-11-26". Daily limits reset at IST midnight.
export function istDay(at: Date = new Date()): string {
  return new Date(at.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function startOfIstDay(at: Date = new Date()): Date {
  const day = istDay(at);
  return new Date(new Date(`${day}T00:00:00.000Z`).getTime() - IST_OFFSET_MS);
}

export const addDays = (d: Date, days: number) => new Date(d.getTime() + days * DAY_MS);

export const daysLeft = (end: Date | null, now = new Date()) =>
  end ? Math.max(0, Math.ceil((end.getTime() - now.getTime()) / DAY_MS)) : 0;
