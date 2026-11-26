import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runAccountDeletion, runRetention, runRequestsAutoclose } from '../src/jobs/handlers.ts';
import { addDays } from '../src/lib/time.ts';
import { adminLogin, APP_CHECK, closeCtx, giveActivePlan, login, loginWithProfile, makeListing, makeUserDirect, newDevice, resetDb, seedBasics, setupCtx, type Ctx } from './helpers.ts';

let ctx: Ctx;
let base: Awaited<ReturnType<typeof seedBasics>>;
beforeAll(async () => {
  ctx = await setupCtx();
});
afterAll(async () => closeCtx(ctx));
beforeEach(async () => {
  await resetDb(ctx.deps);
  base = await seedBasics(ctx.deps);
});

async function uploadPhoto(auth: Record<string, string>, purpose: 'listing' | 'id' | 'proof' = 'listing') {
  const img = await sharp({ create: { width: 640, height: 480, channels: 3, background: '#888' } }).jpeg().toBuffer();
  const sign = await ctx.http().post('/uploads/sign').set(auth).send({ purpose, contentType: 'image/jpeg', sizeBytes: img.length });
  const u = new URL(sign.body.url);
  await ctx.http().put(`${u.pathname}${u.search}`).set('content-type', 'image/jpeg').send(img);
  await ctx.http().post(`/uploads/${sign.body.uploadId}/complete`).set(auth);
  return sign.body.uploadId as string;
}

describe('account deletion (P4-01, P4-02)', () => {
  it('needs a fresh OTP for this same number', async () => {
    const s = await login(ctx);
    const wrong = await ctx.http().post('/me/delete-request').set(s.auth).send({ idToken: 'dev:+919811111111' });
    expect(wrong.status).toBe(401);
    expect((await ctx.deps.db.user.findUniqueOrThrow({ where: { id: s.userId } })).status).toBe('ACTIVE');
  });

  it('hides items at once, logs out, and the job really removes the data', async () => {
    const s = await loginWithProfile(ctx, base.city.id, 'Kavita Rao');
    await giveActivePlan(ctx.deps, s.userId);
    await ctx.deps.db.user.update({ where: { id: s.userId }, data: { createdAt: addDays(new Date(), -5) } });
    const photo = await uploadPhoto(s.auth);
    const created = await ctx.http().post('/listings').set(s.auth).send({
      title: 'Bajaj mixer grinder 750W', description: 'Three jars, works well. Good for functions at home.', categoryId: base.tools.id, areaId: base.area.id, rentDay: 80, condition: 'GOOD', imageIds: [photo], submit: true,
    });
    expect(created.body.listing.status).toBe('LIVE');
    const key = (await ctx.deps.db.listingImage.findFirstOrThrow()).storageKey;
    expect(await ctx.deps.storage.get('photos', key)).not.toBeNull();

    const del = await ctx.http().post('/me/delete-request').set(s.auth).send({ idToken: `dev:${s.phone}`, reason: 'not using' });
    expect(del.status).toBe(200);
    expect((await ctx.http().get('/me').set(s.auth)).status).toBe(401);
    expect((await ctx.http().get(`/listings/${created.body.listing.id}`)).status).toBe(404);
    const again = await ctx.http().post('/auth/firebase').set(APP_CHECK).set('x-device-id', newDevice()).send({ idToken: `dev:${s.phone}` });
    expect(again.body.error.code).toBe('ACCOUNT_DELETION_PENDING');

    await ctx.deps.db.deletionRequest.updateMany({ data: { requestedAt: addDays(new Date(), -2) } });
    expect((await runAccountDeletion(ctx.deps)).deleted).toBe(1);
    const u = await ctx.deps.db.user.findUniqueOrThrow({ where: { id: s.userId } });
    expect(u.phone).not.toBe(s.phone);
    expect(u.name).toBeNull();
    expect(await ctx.deps.db.listingImage.count()).toBe(0);
    expect(await ctx.deps.storage.get('photos', key)).toBeNull();
    expect(await ctx.deps.db.session.count({ where: { userId: s.userId } })).toBe(0);
    expect((await ctx.deps.db.listing.findUniqueOrThrow({ where: { id: created.body.listing.id } })).title).toBe('Removed');

    // the number is free for a new account afterwards
    const fresh = await ctx.http().post('/auth/firebase').set(APP_CHECK).set('x-device-id', newDevice()).send({ idToken: `dev:${s.phone}` });
    expect(fresh.status).toBe(200);
    expect(fresh.body.user.id).not.toBe(s.userId);
  });

  it('web deletion gives the same answer for known and unknown numbers', async () => {
    const s = await login(ctx);
    const known = await ctx.http().post('/delete-account/request').send({ idToken: `dev:${s.phone}` });
    const unknown = await ctx.http().post('/delete-account/request').send({ idToken: 'dev:+919812300000' });
    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect((await ctx.deps.db.user.findUniqueOrThrow({ where: { id: s.userId } })).status).toBe('DELETED');
  });
});

describe('ID verification (P5-07)', () => {
  it('ADMIN cannot see ID documents; Super admin can, every view is logged', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    const up = await uploadPhoto(s.auth, 'id');
    const r = await ctx.http().post('/id-verifications').set(s.auth).send({ uploadId: up });
    expect(r.status).toBe(200);
    const admin = await adminLogin(ctx, 'ADMIN');
    expect((await ctx.http().get('/admin/id-verifications').set(admin.headers)).status).toBe(403);
    expect((await ctx.http().get(`/admin/id-verifications/${r.body.id}/document`).set(admin.headers)).status).toBe(403);
    const sup = await adminLogin(ctx, 'SUPER_ADMIN');
    const doc = await ctx.http().get(`/admin/id-verifications/${r.body.id}/document`).set(sup.headers);
    expect(doc.status).toBe(200);
    expect(await ctx.deps.db.auditLog.count({ where: { action: 'id.view_document' } })).toBe(1);
    const ok = await ctx.http().post(`/admin/id-verifications/${r.body.id}`).set(sup.headers).send({ decision: 'approve' });
    expect(ok.status).toBe(200);
    expect((await ctx.deps.db.user.findUniqueOrThrow({ where: { id: s.userId } })).idVerified).toBe(true);
  });

  it('ID images are deleted 30 days after the decision (time-shifted)', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    const up = await uploadPhoto(s.auth, 'id');
    const r = await ctx.http().post('/id-verifications').set(s.auth).send({ uploadId: up });
    const sup = await adminLogin(ctx, 'SUPER_ADMIN');
    await ctx.http().post(`/admin/id-verifications/${r.body.id}`).set(sup.headers).send({ decision: 'reject', reason: 'Photo is blurry' });
    const row = await ctx.deps.db.idVerification.findUniqueOrThrow({ where: { id: r.body.id } });
    expect(await ctx.deps.storage.get('private', row.docKey!)).not.toBeNull();
    await runRetention(ctx.deps, addDays(new Date(), 29));
    expect((await ctx.deps.db.idVerification.findUniqueOrThrow({ where: { id: r.body.id } })).docKey).not.toBeNull();
    await runRetention(ctx.deps, addDays(new Date(), 31));
    const after = await ctx.deps.db.idVerification.findUniqueOrThrow({ where: { id: r.body.id } });
    expect(after.docKey).toBeNull();
    expect(await ctx.deps.storage.get('private', row.docKey!)).toBeNull();
  });
});

describe('item requests (P5-05)', () => {
  it('notifies listers in the city and category; 5 per day; closes after the dates', async () => {
    const lister = await loginWithProfile(ctx, base.city.id, 'Shop Owner');
    await giveActivePlan(ctx.deps, lister.userId);
    await makeListing(ctx.deps, lister.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    const seeker = await loginWithProfile(ctx, base.city.id, 'Seeker Person');
    const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
    const body = { text: 'Need a DSLR for my sister’s engagement', categoryId: base.cameras.id, fromDate: today, toDate: today };
    const r = await ctx.http().post('/requests').set(seeker.auth).send(body);
    expect(r.status).toBe(200);
    expect(r.body.notified).toBe(1);
    expect(await ctx.deps.db.notification.count({ where: { userId: lister.userId, type: 'ITEM_REQUEST' } })).toBe(1);
    for (let i = 0; i < 4; i++) await ctx.http().post('/requests').set(seeker.auth).send(body);
    expect((await ctx.http().post('/requests').set(seeker.auth).send(body)).status).toBe(429);

    const reply = await ctx.http().post(`/requests/${r.body.id}/contact`).set(lister.auth);
    expect(reply.status).toBe(200);
    expect(reply.body.whatsappUrl).toContain(seeker.phone.slice(1));
    const outsider = await loginWithProfile(ctx, base.city.id, 'No Plan');
    expect((await ctx.http().post(`/requests/${r.body.id}/contact`).set(outsider.auth)).status).toBe(403);

    await ctx.deps.db.itemRequest.updateMany({ data: { toDate: addDays(new Date(), -3) } });
    expect((await runRequestsAutoclose(ctx.deps)).closed).toBe(5);
  });
});

describe('public pages', () => {
  it('T15: pages refuse to load in a frame and send security headers', async () => {
    for (const path of ['/privacy', '/terms', '/delete-account', '/health', '/cities']) {
      const r = await ctx.http().get(path);
      expect(r.headers['x-frame-options'], path).toBe('DENY');
      expect(r.headers['x-content-type-options'], path).toBe('nosniff');
      expect(r.headers['content-security-policy'], path).toContain("frame-ancestors 'none'");
      expect(r.headers['referrer-policy'], path).toBeTruthy();
    }
  });

  it('shared item page shows no phone and escapes the title', async () => {
    const owner = await makeUserDirect(ctx.deps, base.city.id);
    const l = await makeListing(ctx.deps, owner.id, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id, title: 'Camera "pro" <b>bold</b>' });
    const r = await ctx.http().get(`/i/${l.shortId}`);
    expect(r.status).toBe(200);
    expect(r.text).not.toContain(owner.phone.slice(3));
    expect(r.text).not.toContain('<b>bold</b>');
    expect(r.text).toContain('&lt;b&gt;');
    expect((await ctx.http().get('/i/AAAAAAAAAA')).status).toBe(404);
  });

  it('assetlinks.json is served for App Links', async () => {
    const r = await ctx.http().get('/.well-known/assetlinks.json');
    expect(r.status).toBe(200);
    expect(r.body[0].target.package_name).toBe('in.rentnook.app');
  });

  it('privacy policy mentions grievance officer and retention', async () => {
    const r = await ctx.http().get('/privacy');
    expect(r.text).toContain('Grievance Officer');
    expect(r.text).toContain('180 days');
  });

  it('CORS allows only the admin origin', async () => {
    const ok = await ctx.http().options('/admin/auth/me').set('origin', 'http://admin.test').set('access-control-request-method', 'GET');
    expect(ok.headers['access-control-allow-origin']).toBe('http://admin.test');
    const bad = await ctx.http().options('/admin/auth/me').set('origin', 'https://evil.example').set('access-control-request-method', 'GET');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('errors never leak stack traces or SQL', async () => {
    const r = await ctx.http().post('/listings').set('content-type', 'application/json').send('{"broken json');
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).not.toMatch(/at .*\.ts|prisma|SELECT/i);
    expect(Object.keys(r.body)).toEqual(['error']);
  });
});

describe('insights export', () => {
  it('CSV has no personal data and neutralises spreadsheet formulas', async () => {
    const s = await login(ctx);
    await ctx.http().get('/listings').set(s.auth).query({ city: base.city.id, q: '=HYPERLINK("http://x")' });
    const a = await adminLogin(ctx);
    const r = await ctx.http().get('/admin/insights').set(a.headers).query({ format: 'csv' });
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.text).toContain("'=hyperlink");
    expect(r.text).not.toContain(s.phone);
  });
});
