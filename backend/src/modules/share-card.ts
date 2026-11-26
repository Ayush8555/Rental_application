import sharp from 'sharp';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { notFound } from '../lib/errors.ts';
import { formatInr } from '../lib/money.ts';
import { parse } from '../lib/validate.ts';

const W = 1080;
const H = 1350;
const PHOTO_H = 900;

const xml = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

function wrap(text: string, max: number, lines: number) {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    if ((cur + ' ' + w).trim().length > max) {
      out.push(cur.trim());
      cur = w;
      if (out.length === lines) break;
    } else cur += ` ${w}`;
  }
  if (out.length < lines && cur.trim()) out.push(cur.trim());
  if (out.length === lines && words.join(' ').length > out.join(' ').length) out[lines - 1] = `${out[lines - 1]!.slice(0, max - 1)}…`;
  return out;
}

// Image for WhatsApp Status: photo, title, price, area, short link. No phone
// number and no owner name on purpose.
export async function renderShareCard(photo: Buffer | null, l: { title: string; price: string; place: string; link: string }) {
  const titleLines = wrap(l.title, 30, 2);
  const svg = `
<svg width="${W}" height="${H - PHOTO_H}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#FFFFFF"/>
  <rect width="100%" height="8" fill="#0F766E"/>
  ${titleLines.map((t, i) => `<text x="64" y="${100 + i * 64}" font-family="Noto Sans, DejaVu Sans, sans-serif" font-size="52" font-weight="700" fill="#111827">${xml(t)}</text>`).join('')}
  <text x="64" y="${120 + titleLines.length * 64}" font-family="Noto Sans, DejaVu Sans, sans-serif" font-size="56" font-weight="700" fill="#0F766E">${xml(l.price)}</text>
  <text x="64" y="${190 + titleLines.length * 64}" font-family="Noto Sans, DejaVu Sans, sans-serif" font-size="34" fill="#4B5563">${xml(l.place)}</text>
  <text x="64" y="${H - PHOTO_H - 48}" font-family="Noto Sans, DejaVu Sans, sans-serif" font-size="32" fill="#4B5563">${xml(l.link)}</text>
  <text x="${W - 64}" y="${H - PHOTO_H - 48}" text-anchor="end" font-family="Noto Sans, DejaVu Sans, sans-serif" font-size="36" font-weight="700" fill="#0B1F3A">RentNook</text>
</svg>`;
  const top = photo
    ? await sharp(photo).resize(W, PHOTO_H, { fit: 'cover' }).toBuffer()
    : await sharp({ create: { width: W, height: PHOTO_H, channels: 3, background: '#E6F4F2' } }).png().toBuffer();
  return sharp({ create: { width: W, height: H, channels: 3, background: '#FFFFFF' } })
    .composite([
      { input: top, top: 0, left: 0 },
      { input: Buffer.from(svg), top: PHOTO_H, left: 0 },
    ])
    .jpeg({ quality: 85 })
    .toBuffer();
}

export function priceLine(l: { rentDayPaise: number | null; rentWeekPaise: number | null; rentMonthPaise: number | null }) {
  if (l.rentDayPaise) return `${formatInr(l.rentDayPaise)} / day`;
  if (l.rentWeekPaise) return `${formatInr(l.rentWeekPaise)} / week`;
  if (l.rentMonthPaise) return `${formatInr(l.rentMonthPaise)} / month`;
  return '';
}

export default async function shareCardRoutes(app: FastifyInstance, deps: Deps) {
  app.get('/listings/:id/share-card', async (req) => {
    await enforceLimit(deps, 'share-card', req.user?.id ?? req.ip, 30, 3600);
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const l = await deps.db.listing.findUnique({
      where: { id },
      include: { area: true, city: true, images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    });
    if (!l || l.status !== 'LIVE' || !l.city.isOpen) throw notFound('This item is no longer available');
    const key = `share/${l.id}-${l.updatedAt.getTime()}.jpg`;
    const cached = await deps.storage.get('photos', key);
    if (!cached) {
      const photo = l.images[0] ? await deps.storage.get('photos', l.images[0].storageKey) : null;
      const host = new URL(deps.env.PUBLIC_WEB_URL).host;
      const card = await renderShareCard(photo, {
        title: l.title,
        price: priceLine(l),
        place: `${l.area.name}, ${l.city.name}`,
        link: `${host}/i/${l.shortId}`,
      });
      await deps.storage.put('photos', key, card, 'image/jpeg');
    }
    return {
      imageUrl: await deps.storage.signGet('photos', key, 3600),
      link: `${deps.env.PUBLIC_WEB_URL}/i/${l.shortId}`,
      text: `${l.title} on rent — ${priceLine(l)}. See it on RentNook: ${deps.env.PUBLIC_WEB_URL}/i/${l.shortId}`,
    };
  });
}
