const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// 120000 paise -> ₹1,200 ; 79950 -> ₹799.50
export function rupees(paise: number | null | undefined) {
  if (paise === null || paise === undefined) return '—';
  return paise % 100 === 0 ? `₹${inr.format(paise / 100)}` : `₹${inr2.format(paise / 100)}`;
}

export const count = (n: number | null | undefined) => (n === null || n === undefined ? '—' : inr.format(n));

const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const timeFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export const date = (v: string | Date | null | undefined) => (v ? dateFmt.format(new Date(v)) : '—');
export const dateTime = (v: string | Date | null | undefined) => (v ? timeFmt.format(new Date(v)) : '—');

export function ago(v: string | Date | null | undefined) {
  if (!v) return '—';
  const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)} d ago`;
  return date(v);
}

export function rentLine(l: { rentDayPaise?: number | null; rentWeekPaise?: number | null; rentMonthPaise?: number | null }) {
  const parts = [
    l.rentDayPaise ? `${rupees(l.rentDayPaise)}/day` : null,
    l.rentWeekPaise ? `${rupees(l.rentWeekPaise)}/week` : null,
    l.rentMonthPaise ? `${rupees(l.rentMonthPaise)}/month` : null,
  ].filter(Boolean);
  return parts.join(' · ') || '—';
}

export const humanize = (code: string) => code.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
