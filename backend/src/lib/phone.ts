// Indian mobile numbers only: +91 followed by 10 digits starting 6-9.
const E164_IN = /^\+91[6-9]\d{9}$/;

export function isIndianMobile(e164: string): boolean {
  return E164_IN.test(e164);
}

export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[\s-]/g, '');
  if (E164_IN.test(digits)) return digits;
  if (/^[6-9]\d{9}$/.test(digits)) return `+91${digits}`;
  if (/^91[6-9]\d{9}$/.test(digits)) return `+${digits}`;
  return null;
}

// +919812345610 -> 98XXXXXX10
export function maskPhone(e164: string | null | undefined): string {
  if (!e164 || !e164.startsWith('+91')) return 'XXXXXXXXXX';
  const n = e164.slice(3);
  return `${n.slice(0, 2)}XXXXXX${n.slice(-2)}`;
}

export const lastFour = (e164: string) => e164.slice(-4);
