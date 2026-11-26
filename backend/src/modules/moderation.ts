import type { Db } from '../services/db.ts';
import { hammingHex } from '../services/images.ts';
import { scamHits } from '../lib/text-filter.ts';

// Automatic checks that only raise flags for the admin review queue (P5-12).
// They never reject anything on their own.
export async function moderationFlags(
  db: Db,
  input: { userId: string; cityId: string; categoryId: string; title: string; description: string; minRentPaise: number; dhashes: string[]; listingId?: string },
): Promise<string[]> {
  const flags: string[] = [];

  if (scamHits(`${input.title}\n${input.description}`).length) flags.push('SCAM_WORDS');

  // Price outlier: compare with the middle price of the same category in the
  // same city. Needs a few samples to mean anything.
  const prices = await db.listing.findMany({
    where: { cityId: input.cityId, categoryId: input.categoryId, status: 'LIVE', id: input.listingId ? { not: input.listingId } : undefined },
    select: { minRentPaise: true },
    take: 200,
    orderBy: { publishedAt: 'desc' },
  });
  if (prices.length >= 5) {
    const sorted = prices.map((p) => p.minRentPaise).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)]!;
    if (input.minRentPaise < median / 5 || input.minRentPaise > median * 8) flags.push('PRICE_OUTLIER');
  }

  // Same photo already used by a different lister.
  if (input.dhashes.length) {
    const others = await db.listingImage.findMany({
      where: { listing: { userId: { not: input.userId }, status: { not: 'REMOVED' } } },
      select: { dhash: true },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    const dup = input.dhashes.some((h) => others.some((o) => hammingHex(h, o.dhash) <= 4));
    if (dup) flags.push('DUPLICATE_PHOTO');
  }

  return flags;
}
