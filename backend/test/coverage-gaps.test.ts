import sharp from 'sharp';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.ts';
import { runBoosts, runBroadcast, runDailySummary } from '../src/jobs/handlers.ts';
import { displayKm, distanceKm, roundCoord } from '../src/lib/geo.ts';
import { formatInr, paiseToUpiAmount } from '../src/lib/money.ts';
import { maskPhone, normalisePhone } from '../src/lib/phone.ts';
import { cleanListingText, scamHits } from '../src/lib/text-filter.ts';
import { addDays } from '../src/lib/time.ts';
import { render } from '../src/services/notify.ts';
import { decrypt, encrypt } from '../src/lib/crypto.ts';
import { adminLogin, closeCtx, giveActivePlan, login, loginWithProfile, makeListing, makePlan, makeUserDirect, resetDb, seedBasics, setupCtx, stepUp, type AdminSessionInfo, type Ctx } from './helpers.ts';

let ctx: Ctx;
let base: Awaited<ReturnType<typeof seedBasics>>;
let admin: AdminSessionInfo;
beforeAll(async () => {
  ctx = await setupCtx();
});
afterAll(async () => closeCtx(ctx));
beforeEach(async () => {
  await resetDb(ctx.deps);
  base = await seedBasics(ctx.deps);
  admin = await adminLogin(ctx);
});

describe('small helpers', () => {
  it('phone, money and geo helpers', () => {
    expect(normalisePhone('98765 43210')).toBe('+919876543210');
    expect(normalisePhone('919876543210')).toBe('+919876543210');
    expect(normalisePhone('12345')).toBeNull();
    expect(maskPhone('+919876543210')).toBe('98XXXXXX10');
    expect(maskPhone(null)).toBe('XXXXXXXXXX');
    expect(paiseToUpiAmount(79900)).toBe('799');
    expect(paiseToUpiAmount(79950)).toBe('799.50');
    expect(formatInr(12_000_000)).toBe('₹1,20,000');
    expect(roundCoord(26.8506)).toBeCloseTo(26.85, 3);
    expect(displayKm(distanceKm(26.85, 81.0, 26.89, 80.94))).toBeGreaterThan(5);
    expect(displayKm(0.01)).toBe(0.5);
  });

  it('catches contact details written in creative ways and flags scam words', () => {
    for (const t of ['call 9876543210', 'ph 98-7654-3210', '+91 98765 43210', 'mail me a.b@yahoo.co.in', 'insta.com/abc', 'visit http://x.y']) {
      expect(cleanListingText(`Good item, ${t} thanks`).removed, t).toBe(true);
    }
    expect(cleanListingText('Canon 1500D, 18-55mm lens, 2019 model').removed).toBe(false);
    expect(scamHits('Pay advance first via gift card')).toEqual(expect.arrayContaining(['pay advance', 'gift card']));
  });

  it('TOTP secret encryption rejects truncated auth tags', () => {
    const key = Buffer.alloc(32, 3).toString('base64');
    const blob = encrypt(key, 'JBSWY3DPEHPK3PXP');
    expect(decrypt(key, blob)).toBe('JBSWY3DPEHPK3PXP');
    const [iv, tag, data] = blob.split('.');
    const short = [iv, Buffer.from(tag!, 'base64url').subarray(0, 4).toString('base64url'), data].join('.');
    expect(() => decrypt(key, short)).toThrow();
  });

  it('notification templates exist in English and Hindi', () => {
    expect(render('PLAN_EXPIRING', 'hi', { days: 3, plan: 'मासिक' }).title).toContain('3');
    expect(render('PAYMENT_APPROVED', 'en', { what: 'Monthly' }).body).toContain('Monthly');
    expect(() => render('NOPE', 'en', {})).toThrow();
  });
});

describe('config safety', () => {
  const good = {
    DATABASE_URL: 'postgresql://x',
    JWT_ACCESS_SECRET: 'a'.repeat(64),
    REFRESH_TOKEN_PEPPER: 'b'.repeat(64),
    ADMIN_SESSION_SECRET: 'c'.repeat(64),
    CSRF_SECRET: 'd'.repeat(64),
    TOTP_ENC_KEY: Buffer.alloc(32).toString('base64'),
    URL_SIGNING_SECRET: 'e'.repeat(64),
  };
  it('production refuses dev auth, local storage, no App Check and weak secrets', () => {
    expect(() => loadEnv({ ...good, NODE_ENV: 'production' })).toThrow(/AUTH_PROVIDER[\s\S]*STORAGE_DRIVER/);
    expect(() =>
      loadEnv({ ...good, NODE_ENV: 'production', AUTH_PROVIDER: 'firebase', STORAGE_DRIVER: 's3', FIREBASE_PROJECT_ID: 'p', PUSH_PROVIDER: 'fcm', CAPTCHA_PROVIDER: 'turnstile' }),
    ).toThrow(/APP_CHECK_ENFORCE/);
    expect(() =>
      loadEnv({ ...good, JWT_ACCESS_SECRET: 'change-me'.repeat(8), NODE_ENV: 'staging', AUTH_PROVIDER: 'firebase', STORAGE_DRIVER: 's3', FIREBASE_PROJECT_ID: 'p' }),
    ).toThrow(/JWT_ACCESS_SECRET/);
    const ok = loadEnv({ ...good, NODE_ENV: 'production', AUTH_PROVIDER: 'firebase', STORAGE_DRIVER: 's3', FIREBASE_PROJECT_ID: 'p', PUSH_PROVIDER: 'fcm', CAPTCHA_PROVIDER: 'turnstile', APP_CHECK_ENFORCE: 'true' });
    expect(ok.APP_CHECK_ENFORCE).toBe(true);
  });
  it('error messages name variables but never print their values', () => {
    try {
      loadEnv({ ...good, JWT_ACCESS_SECRET: 'short-secret-value' });
    } catch (e) {
      expect(String(e)).not.toContain('short-secret-value');
    }
  });
});

describe('catalogue and settings', () => {
  it('public catalogue and settings', async () => {
    const cities = await ctx.http().get('/cities');
    expect(cities.body.items.map((c: { name: string }) => c.name)).toEqual(['Lucknow', 'Pune']);
    const areas = await ctx.http().get(`/cities/${base.city.id}/areas`);
    expect(areas.body.items).toHaveLength(2);
    const cats = await ctx.http().get('/categories');
    expect(cats.body.items).toHaveLength(2);
    const s = await ctx.http().get('/settings/public');
    expect(s.body.minAppVersion).toBe('1.0.0');
    expect(JSON.stringify(s.body)).not.toContain('okaxis'); // UPI id is only handed out per payment
  });

  it('admin manages cities, areas, categories and settings', async () => {
    const dup = await ctx.http().post('/admin/cities').set(admin.headers).send({ name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.85, lng: 80.95 });
    expect(dup.status).toBe(409);
    const area = await ctx.http().post('/admin/areas').set(admin.headers).send({ cityId: base.city.id, name: 'Hazratganj', lat: 26.85, lng: 80.94 });
    expect(area.status).toBe(200);
    expect((await ctx.http().patch(`/admin/areas/${area.body.id}`).set(admin.headers).send({ name: 'Hazrat Ganj' })).body.name).toBe('Hazrat Ganj');
    expect((await ctx.http().get('/admin/areas').set(admin.headers).query({ cityId: base.city.id })).body.items).toHaveLength(3);
    expect((await ctx.http().get('/admin/cities').set(admin.headers)).body.items).toHaveLength(2);
    expect((await ctx.http().get(`/admin/cities/${base.closed.id}/waitlist`).set(admin.headers)).body.count).toBe(0);

    const bad = await ctx.http().post('/admin/categories').set(admin.headers).send({ name: 'Bikes', nameHi: 'बाइक', icon: '<script>', sortOrder: 5 });
    expect(bad.status).toBe(400);
    const sameOrder = await ctx.http().post('/admin/categories').set(admin.headers).send({ name: 'Bikes', nameHi: 'बाइक', icon: 'bicycle', sortOrder: 1 });
    expect(sameOrder.status).toBe(409);
    const withFields = await ctx.http().post('/admin/categories').set(admin.headers).send({
      name: 'Bikes', nameHi: 'बाइक', icon: 'bicycle', sortOrder: 7, fieldsSchema: [{ key: 'gears', label: 'Gears', type: 'number' }],
    });
    expect(withFields.status).toBe(200);
    await ctx.http().patch(`/admin/categories/${withFields.body.id}`).set(admin.headers).send({ isActive: false });
    expect((await ctx.http().get('/categories')).body.items).toHaveLength(2);
    expect((await ctx.http().get('/admin/categories').set(admin.headers)).body.items).toHaveLength(3);

    const settings = await ctx.http().get('/admin/settings').set(admin.headers);
    expect(settings.body.canEditAll).toBe(false);
    expect((await ctx.http().put('/admin/settings/moderation').set(admin.headers).send({ reviewNewItems: true })).status).toBe(200);
    expect((await ctx.http().put('/admin/settings/limits').set(admin.headers).send({})).status).toBe(403);
  });

  it('moderation switch sends new items to the review queue', async () => {
    await ctx.http().put('/admin/settings/moderation').set(admin.headers).send({ reviewNewItems: true });
    const s = await loginWithProfile(ctx, base.city.id);
    await giveActivePlan(ctx.deps, s.userId);
    const img = await ctx.deps.db.upload.create({ data: { userId: s.userId, purpose: 'listing', rawKey: 'raw/listing/aa', finalKey: 'listing/aa.webp', status: 'READY', width: 1, height: 1, hash: 'h', dhash: 'ffffffffffffffff', expiresAt: addDays(new Date(), 1) } });
    const r = await ctx.http().post('/listings').set(s.auth).send({ title: 'Folding table for events', description: 'Six feet folding table, strong legs, easy to carry.', categoryId: base.tools.id, areaId: base.area.id, rentDay: 150, condition: 'GOOD', imageIds: [img.id], submit: true });
    expect(r.body.listing.status).toBe('REVIEW');
  });
});

describe('shops and share card', () => {
  it('shop page only with a Business plan', async () => {
    const s = await loginWithProfile(ctx, base.city.id, 'Gupta Rentals');
    const body = { shopName: 'Gupta Tent House', areaId: base.area.id, timings: '9 am – 9 pm, all days', about: 'Tents, chairs and lights for functions since 1998.' };
    expect((await ctx.http().put('/shops/me').set(s.auth).send(body)).status).toBe(403);
    const plan = await makePlan(ctx.deps, { type: 'BUSINESS', shopPage: true, listingLimit: null, pricePaise: 199900 });
    await ctx.deps.db.subscription.create({ data: { userId: s.userId, planId: plan.id, planName: 'Business', planNameHi: 'बिज़नेस', planType: 'BUSINESS', pricePaise: 199900, durationDays: 90, listingLimit: null, boostCredits: 2, shopPage: true, status: 'ACTIVE', startsAt: addDays(new Date(), -1), endsAt: addDays(new Date(), 80), boostCreditsLeft: 2 } });
    const put = await ctx.http().put('/shops/me').set(s.auth).send({ ...body, about: 'Call 9876543210 for tents' });
    expect(put.status).toBe(200);
    await makeListing(ctx.deps, s.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.tools.id });
    const pub = await ctx.http().get(`/shops/${put.body.id}`);
    expect(pub.status).toBe(200);
    expect(pub.body.about).not.toContain('9876');
    expect(pub.body.items).toHaveLength(1);
    expect((await ctx.http().get('/shops/me').set(s.auth)).body.allowed).toBe(true);
    const web = await ctx.http().get(`/s/${put.body.id}`);
    expect(web.status).toBe(200);
    expect(web.text).toContain('Gupta Tent House');

    // boost credits from the Business plan
    const l = await ctx.deps.db.listing.findFirstOrThrow({ where: { userId: s.userId } });
    const b1 = await ctx.http().post(`/listings/${l.id}/boost`).set(s.auth).send({ days: 7, useCredit: true });
    expect(b1.body.boost.status).toBe('ACTIVE');
    await ctx.http().post(`/listings/${l.id}/boost`).set(s.auth).send({ days: 7, useCredit: true });
    expect((await ctx.http().post(`/listings/${l.id}/boost`).set(s.auth).send({ days: 7, useCredit: true })).body.error.code).toBe('NO_CREDITS');
    await ctx.deps.db.boost.updateMany({ data: { endsAt: addDays(new Date(), -1) } });
    expect((await runBoosts(ctx.deps)).ended).toBe(2);
  });

  it('share card has no phone number and is cached', async () => {
    const owner = await makeUserDirect(ctx.deps, base.city.id);
    const l = await makeListing(ctx.deps, owner.id, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    const photo = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#345' } }).webp().toBuffer();
    await ctx.deps.storage.put('photos', 'listing/card-test.webp', photo, 'image/webp');
    await ctx.deps.db.listingImage.create({ data: { listingId: l.id, storageKey: 'listing/card-test.webp', width: 800, height: 600, sortOrder: 0, hash: 'x', dhash: '0' } });
    const r = await ctx.http().get(`/listings/${l.id}/share-card`);
    expect(r.status).toBe(200);
    expect(r.body.text).not.toContain(owner.phone.slice(3));
    expect(r.body.link).toContain(`/i/${l.shortId}`);
    const again = await ctx.http().get(`/listings/${l.id}/share-card`);
    expect(again.status).toBe(200);
  });
});

describe('notifications and devices', () => {
  it('lists, marks read and caps devices', async () => {
    const s = await login(ctx);
    for (let i = 0; i < 7; i++) await ctx.http().post('/devices').set(s.auth).send({ fcmToken: `fcm-device-token-number-${i}-abcdef`, platform: 'android' });
    expect(await ctx.deps.db.deviceToken.count({ where: { userId: s.userId } })).toBe(5);
    await ctx.deps.notifier.toUser(s.userId, 'ID_APPROVED', {});
    const list = await ctx.http().get('/notifications').set(s.auth);
    expect(list.body.unread).toBe(1);
    await ctx.http().post('/notifications/read').set(s.auth).send({ all: true });
    expect((await ctx.http().get('/notifications').set(s.auth)).body.unread).toBe(0);
    expect((await ctx.http().delete('/devices/fcm-device-token-number-6-abcdef').set(s.auth)).status).toBe(200);
  });

  it('broadcast goes out in batches and is limited per day', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    await ctx.http().post('/devices').set(s.auth).send({ fcmToken: 'fcm-broadcast-token-abcdefghijk', platform: 'android' });
    const preview = await ctx.http().post('/admin/push/preview').set(admin.headers).send({ audience: 'city', cityId: base.city.id });
    expect(preview.body.audienceSize).toBe(1);
    const sent = await ctx.http().post('/admin/push').set(admin.headers).send({ audience: 'all', title: 'Diwali offer', body: '20% off on Quarterly plan this week' });
    expect(sent.status).toBe(200);
    const b = await ctx.deps.db.broadcast.findUniqueOrThrow({ where: { id: sent.body.id } });
    expect(b.status).toBe('DONE');
    expect((await runBroadcast(ctx.deps, b.id)).sent).toBe(0); // idempotent
    for (let i = 0; i < 2; i++) await ctx.http().post('/admin/push').set(admin.headers).send({ audience: 'all', title: 'Hello there', body: 'Short note for everyone' });
    expect((await ctx.http().post('/admin/push').set(admin.headers).send({ audience: 'all', title: 'Too many', body: 'This one is blocked' })).status).toBe(429);
    expect((await ctx.http().get('/admin/push').set(admin.headers)).body.items).toHaveLength(3);
  });
});

describe('admin lists', () => {
  it('payments queue flags duplicate UTRs, screenshot via signed link, daily summary', async () => {
    const plan = await makePlan(ctx.deps);
    const s = await loginWithProfile(ctx, base.city.id);
    const b = await ctx.http().post('/subscriptions').set(s.auth).send({ planId: plan.id });
    const img = await sharp({ create: { width: 300, height: 600, channels: 3, background: '#eee' } }).png().toBuffer();
    const sign = await ctx.http().post('/uploads/sign').set(s.auth).send({ purpose: 'proof', contentType: 'image/png', sizeBytes: img.length });
    const u = new URL(sign.body.url);
    await ctx.http().put(`${u.pathname}${u.search}`).set('content-type', 'image/png').send(img);
    await ctx.http().post(`/uploads/${sign.body.uploadId}/complete`).set(s.auth);
    const proof = await ctx.http().post(`/payments/${b.body.payment.id}/proof`).set(s.auth).send({ utr: '412345678901', screenshotUploadId: sign.body.uploadId });
    expect(proof.status).toBe(200);
    const q = await ctx.http().get('/admin/payments').set(admin.headers);
    expect(q.body.items[0].duplicateUtr).toBe(false);
    expect(q.body.items[0].hasScreenshot).toBe(true);
    const shot = await ctx.http().get(`/admin/payments/${b.body.payment.id}/screenshot`).set(admin.headers);
    expect(shot.body.url).toContain('exp=');
    const one = await ctx.http().get(`/payments/${b.body.payment.id}`).set(s.auth);
    expect(one.body.status).toBe('PENDING');
    await ctx.http().post(`/admin/payments/${b.body.payment.id}/reject`).set(admin.headers).send({ reason: 'Amount does not match' });
    expect((await runDailySummary(ctx.deps)).rows).toBe(1);
  });

  it('users, reports and plans screens', async () => {
    const s = await loginWithProfile(ctx, base.city.id, 'Report Target');
    const l = await makeListing(ctx.deps, s.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    const reporter = await login(ctx);
    await ctx.http().post('/reports').set(reporter.auth).send({ listingId: l.id, reason: 'OFFENSIVE' });
    await ctx.http().post('/reports').set(reporter.auth).send({ userId: s.userId, reason: 'OTHER', note: 'rude on chat' });
    const reports = await ctx.http().get('/admin/reports').set(admin.headers);
    expect(reports.body.total).toBe(2);
    expect(JSON.stringify(reports.body)).not.toContain(reporter.phone);
    const act = await ctx.http().post(`/admin/reports/${reports.body.items[0].id}/action`).set(admin.headers).send({ action: 'warn', note: 'Please keep the listing clean' });
    expect(act.status).toBe(200);
    const detail = await ctx.http().get(`/admin/users/${s.userId}`).set(admin.headers);
    expect(detail.body.listings).toHaveLength(1);
    expect(JSON.stringify(detail.body)).not.toContain(s.phone);
    await ctx.http().post(`/admin/users/${s.userId}/block`).set(admin.headers).send({ reason: 'repeated scams' });
    expect((await ctx.http().post(`/admin/users/${s.userId}/unblock`).set(admin.headers).send({ reason: 'appeal accepted' })).status).toBe(200);

    const plan = { name: 'Diwali 45', nameHi: 'दिवाली 45', type: 'PAID', pricePaise: 39900, durationDays: 45, listingLimit: 8, maxPerUser: 1, badge: 'Offer', validFrom: new Date().toISOString(), validTo: addDays(new Date(), 10).toISOString() };
    expect((await ctx.http().post('/admin/plans').set(admin.headers).send({ ...plan, pricePaise: 0 })).status).toBe(400);
    expect((await ctx.http().post('/admin/plans').set(admin.headers).send({ ...plan, type: 'FREE', maxPerUser: null, pricePaise: 0 })).status).toBe(400);
    expect((await ctx.http().post('/admin/plans').set(admin.headers).send({ ...plan, durationDays: 800 })).status).toBe(400);
    const created = await ctx.http().post('/admin/plans').set(admin.headers).send(plan);
    expect(created.status).toBe(200);
    expect((await ctx.http().get('/admin/plans').set(admin.headers)).body.items).toHaveLength(1);
    expect((await ctx.http().delete(`/admin/plans/${created.body.id}`).set(admin.headers)).status).toBe(200);
    const seeker = await loginWithProfile(ctx, base.city.id);
    expect((await ctx.http().get('/plans').set(seeker.auth)).body.items).toHaveLength(0);
  });

  it('coupons screen and insights', async () => {
    const c = { code: 'WELCOME50', type: 'FLAT', value: 5000, validFrom: new Date().toISOString(), validTo: addDays(new Date(), 30).toISOString(), maxUses: 100 };
    expect((await ctx.http().post('/admin/coupons').set(admin.headers).send({ ...c, type: 'PERCENT', value: 95 })).status).toBe(400);
    const made = await ctx.http().post('/admin/coupons').set(admin.headers).send(c);
    expect((await ctx.http().post('/admin/coupons').set(admin.headers).send(c)).status).toBe(409);
    expect((await ctx.http().put(`/admin/coupons/${made.body.id}`).set(admin.headers).send({ ...c, maxUses: 10 })).body.maxUses).toBe(10);
    expect((await ctx.http().get('/admin/coupons').set(admin.headers)).body.items).toHaveLength(1);
    const ins = await ctx.http().get('/admin/insights').set(admin.headers);
    expect(ins.body.categories).toHaveLength(2);
  });

  it('referral summary, lister summary and my subscriptions', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    await giveActivePlan(ctx.deps, s.userId, 3);
    await makeListing(ctx.deps, s.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    const sum = await ctx.http().get('/me/lister-summary').set(s.auth);
    expect(sum.body.limit).toBe(3);
    expect(sum.body.liveCount).toBe(1);
    expect((await ctx.http().get('/subscriptions/mine').set(s.auth)).body.items).toHaveLength(1);
    expect((await ctx.http().get('/referral').set(s.auth)).body.shareLink).toContain('/r/');
    expect((await ctx.http().get('/me/consents').set(s.auth)).body.items).toHaveLength(1);
    expect((await ctx.http().get('/id-verifications/mine').set(s.auth)).body.verified).toBe(false);
    const me = await ctx.http().get('/me').set(s.auth);
    expect(me.body.plan.daysLeft).toBeGreaterThan(20);
  });

  it('super admin manages sessions and admins list', async () => {
    const sup = await adminLogin(ctx, 'SUPER_ADMIN');
    const sessions = await ctx.http().get('/admin/auth/sessions').set(sup.headers);
    expect(sessions.body.items.some((x: { current: boolean }) => x.current)).toBe(true);
    const list = await ctx.http().get('/admin/admins').set(sup.headers);
    expect(list.body.items.length).toBeGreaterThanOrEqual(2);
    await stepUp(ctx, sup);
    expect((await ctx.http().patch(`/admin/admins/${sup.id}`).set(sup.headers).send({ disabled: true })).status).toBe(403);
    const me = await ctx.http().get('/admin/auth/me').set(sup.headers);
    expect(me.body.stage).toBe('ready');
    expect((await ctx.http().post('/admin/auth/logout').set(sup.headers)).status).toBe(200);
    expect((await ctx.http().get('/admin/auth/me').set(sup.headers)).status).toBe(401);
  });
});
