import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, login, resetDb, setupCtx, type Ctx, type Session } from './helpers.ts';

let ctx: Ctx;
let s: Session;
beforeAll(async () => {
  ctx = await setupCtx();
});
afterAll(async () => closeCtx(ctx));
beforeEach(async () => {
  await resetDb(ctx.deps);
  s = await login(ctx);
});

async function upload(body: Buffer, contentType = 'image/jpeg', purpose = 'listing') {
  const sign = await ctx.http().post('/uploads/sign').set(s.auth).send({ purpose, contentType, sizeBytes: Math.max(100, body.length) });
  if (sign.status !== 200) return { sign };
  const u = new URL(sign.body.url);
  const put = await ctx.http().put(`${u.pathname}${u.search}`).set('content-type', contentType).send(body);
  const done = await ctx.http().post(`/uploads/${sign.body.uploadId}/complete`).set(s.auth);
  return { sign, put, done, id: sign.body.uploadId as string };
}

async function photoWithGps() {
  return sharp({ create: { width: 1200, height: 900, channels: 3, background: '#c0a080' } })
    .jpeg()
    .withExif({ IFD0: { Make: 'TestPhone', Model: 'X1' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '26/1 51/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '80/1 56/1 0/1' } })
    .toBuffer();
}

describe('photo uploads', () => {
  it('accepts a normal photo and re-encodes it to WebP', async () => {
    const r = await upload(await photoWithGps());
    expect(r.done!.status).toBe(200);
    const row = await ctx.deps.db.upload.findUniqueOrThrow({ where: { id: r.id } });
    expect(row.finalKey).toMatch(/^listing\/[0-9a-f-]{36}\.webp$/);
    expect(row.width).toBe(1200);
  });

  it('T12: GPS and camera EXIF are gone after processing', async () => {
    const original = await photoWithGps();
    expect((await sharp(original).metadata()).exif).toBeDefined();
    const r = await upload(original);
    const row = await ctx.deps.db.upload.findUniqueOrThrow({ where: { id: r.id } });
    const stored = await ctx.deps.storage.get('photos', row.finalKey!);
    const meta = await sharp(stored!).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.exif).toBeUndefined();
    expect(stored!.includes(Buffer.from('TestPhone'))).toBe(false);
  });

  it('T11: svg, php, renamed exe and huge images are all rejected', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    const php = Buffer.from('<?php system($_GET["c"]); ?>'.padEnd(200, ' '));
    const exe = Buffer.concat([Buffer.from('MZ'), Buffer.alloc(400, 1)]);
    for (const bad of [svg, php, exe]) {
      const r = await upload(bad);
      expect(r.done!.status).toBe(400);
      expect(r.done!.body.error.code).toBe('NOT_AN_IMAGE');
    }
    expect((await ctx.http().post('/uploads/sign').set(s.auth).send({ purpose: 'listing', contentType: 'image/svg+xml', sizeBytes: 1000 })).status).toBe(400);
    const tooBig = await ctx.http().post('/uploads/sign').set(s.auth).send({ purpose: 'listing', contentType: 'image/jpeg', sizeBytes: 30 * 1024 * 1024 });
    expect(tooBig.status).toBe(400);
    const wide = await sharp({ create: { width: 20_000, height: 10, channels: 3, background: '#fff' } }).png().toBuffer();
    const r = await upload(wide, 'image/png');
    expect(r.done!.status).toBe(400);
    expect(r.done!.body.error.code).toBe('TOO_MANY_PIXELS');
  });

  it('a JPEG with a PHP tail is cleaned by re-encoding', async () => {
    const tail = Buffer.concat([await photoWithGps(), Buffer.from('<?php echo "pwned"; ?>')]);
    const r = await upload(tail);
    expect(r.done!.status).toBe(200);
    const row = await ctx.deps.db.upload.findUniqueOrThrow({ where: { id: r.id } });
    const stored = await ctx.deps.storage.get('photos', row.finalKey!);
    expect(stored!.includes(Buffer.from('<?php'))).toBe(false);
  });

  it('nobody else can complete or attach my upload', async () => {
    const mine = await upload(await photoWithGps());
    const other = await login(ctx);
    expect((await ctx.http().post(`/uploads/${mine.id}/complete`).set(other.auth)).status).toBe(404);
  });

  it('signed local URLs cannot be reused for another key', async () => {
    const sign = await ctx.http().post('/uploads/sign').set(s.auth).send({ purpose: 'listing', contentType: 'image/jpeg', sizeBytes: 1000 });
    const u = new URL(sign.body.url);
    u.searchParams.set('k', 'listing/evil.webp');
    const put = await ctx.http().put(`${u.pathname}${u.search}`).set('content-type', 'image/jpeg').send(Buffer.alloc(200));
    expect(put.status).toBe(403);
  });
});
