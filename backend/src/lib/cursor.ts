import { badRequest } from './errors.ts';

// Opaque cursor: base64url JSON {o: offset}. Offset paging is fine at our size
// and the hard cap below also limits how deep a scraper can walk.
export const MAX_PAGE = 50;
export const MAX_OFFSET = 2000;

export function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { o?: unknown };
    const o = Number(raw.o);
    if (!Number.isInteger(o) || o < 0 || o > MAX_OFFSET) throw new Error('range');
    return o;
  } catch {
    throw badRequest('Invalid cursor', 'BAD_CURSOR');
  }
}

export function encodeCursor(offset: number): string | null {
  if (offset > MAX_OFFSET) return null;
  return Buffer.from(JSON.stringify({ o: offset })).toString('base64url');
}

export const clampLimit = (n: number | undefined, def = 20) => Math.min(Math.max(n ?? def, 1), MAX_PAGE);
