import { SignJWT } from 'jose';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { APP_CHECK, closeCtx, login, newDevice, newPhone, resetDb, seedBasics, setupCtx, type Ctx } from './helpers.ts';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await setupCtx();
});
afterAll(async () => closeCtx(ctx));
beforeEach(async () => {
  await resetDb(ctx.deps);
});

const secret = () => new TextEncoder().encode(ctx.deps.env.JWT_ACCESS_SECRET);

describe('phone login', () => {
  it('creates an account from a verified token and records consent', async () => {
    const s = await login(ctx);
    const consent = await ctx.deps.db.consentLog.findMany({ where: { userId: s.userId } });
    expect(consent).toHaveLength(1);
    const me = await ctx.http().get('/me').set(s.auth);
    expect(me.status).toBe(200);
    expect(me.body.phoneMasked).toMatch(/^\d{2}X{6}\d{2}$/);
    expect(JSON.stringify(me.body)).not.toContain(s.phone.slice(3));
  });

  it('T22: new and existing numbers get the same response shape', async () => {
    const phone = newPhone();
    const first = await ctx.http().post('/auth/firebase').set(APP_CHECK).set('x-device-id', newDevice()).send({ idToken: `dev:${phone}` });
    const second = await ctx.http().post('/auth/firebase').set(APP_CHECK).set('x-device-id', newDevice()).send({ idToken: `dev:${phone}` });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(Object.keys(first.body).sort()).toEqual(Object.keys(second.body).sort());
  });

  it('refuses numbers outside India', async () => {
    const res = await ctx.http().post('/auth/firebase').set(APP_CHECK).set('x-device-id', newDevice()).send({ idToken: 'dev:+14155550100' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('PHONE_NOT_ALLOWED');
  });

  it('rejects a tampered Firebase token', async () => {
    const res = await ctx.http().post('/auth/firebase').set(APP_CHECK).set('x-device-id', newDevice()).send({ idToken: 'not-a-real-firebase-token' });
    expect(res.status).toBe(401);
  });

  it('rejects unknown body fields', async () => {
    const res = await ctx.http().post('/auth/firebase').set(APP_CHECK).send({ idToken: `dev:${newPhone()}`, role: 'ADMIN' });
    expect(res.status).toBe(400);
    expect(res.body.error.details.fields.role).toBe('not allowed');
  });

  it('rate limits /auth per device (5/min)', async () => {
    const device = newDevice();
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      const r = await ctx.http().post('/auth/firebase').set(APP_CHECK).set('x-device-id', device).send({ idToken: `dev:${newPhone()}` });
      codes.push(r.status);
    }
    expect(codes.slice(0, 5).every((c) => c === 200)).toBe(true);
    expect(codes.slice(5)).toEqual([429, 429]);
  });
});

describe('access tokens', () => {
  it('rejects an expired token', async () => {
    const s = await login(ctx);
    const session = await ctx.deps.db.session.findFirstOrThrow({ where: { userId: s.userId } });
    const token = await new SignJWT({ sid: session.id })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(s.userId)
      .setIssuer(ctx.deps.env.JWT_ISSUER)
      .setAudience(ctx.deps.env.JWT_AUDIENCE)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret());
    const res = await ctx.http().get('/me').set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects a token signed with another secret', async () => {
    const s = await login(ctx);
    const token = await new SignJWT({ sid: 'x' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(s.userId)
      .setIssuer(ctx.deps.env.JWT_ISSUER)
      .setAudience(ctx.deps.env.JWT_AUDIENCE)
      .setExpirationTime('10m')
      .sign(new TextEncoder().encode('someone-elses-secret-someone-elses-secret'));
    expect((await ctx.http().get('/me').set('authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('rejects alg=none tokens', async () => {
    const s = await login(ctx);
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const token = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: s.userId, sid: 'x', iss: ctx.deps.env.JWT_ISSUER, aud: ctx.deps.env.JWT_AUDIENCE, exp: 9999999999 })}.`;
    expect((await ctx.http().get('/me').set('authorization', `Bearer ${token}`)).status).toBe(401);
  });

  it('T17: a blocked user’s old token stops working', async () => {
    const s = await login(ctx);
    await ctx.deps.db.user.update({ where: { id: s.userId }, data: { status: 'BLOCKED' } });
    await ctx.deps.db.session.updateMany({ where: { userId: s.userId }, data: { revokedAt: new Date() } });
    expect((await ctx.http().get('/me').set(s.auth)).status).toBe(401);
  });

  it('blocked users cannot log in again', async () => {
    const s = await login(ctx);
    await ctx.deps.db.user.update({ where: { id: s.userId }, data: { status: 'BLOCKED' } });
    const res = await ctx.http().post('/auth/firebase').set(APP_CHECK).set('x-device-id', newDevice()).send({ idToken: `dev:${s.phone}` });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_BLOCKED');
  });
});

describe('refresh tokens', () => {
  it('rotates on every refresh', async () => {
    const s = await login(ctx);
    const r1 = await ctx.http().post('/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(r1.status).toBe(200);
    expect(r1.body.refreshToken).not.toBe(s.refreshToken);
    const r2 = await ctx.http().post('/auth/refresh').send({ refreshToken: r1.body.refreshToken });
    expect(r2.status).toBe(200);
  });

  it('T16: reusing an old refresh token revokes every session', async () => {
    const s = await login(ctx);
    const other = await ctx.http().post('/auth/firebase').set(APP_CHECK).set('x-device-id', newDevice()).send({ idToken: `dev:${s.phone}` });
    const r1 = await ctx.http().post('/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(r1.status).toBe(200);
    // attacker replays the stolen old token
    const replay = await ctx.http().post('/auth/refresh').send({ refreshToken: s.refreshToken });
    expect(replay.status).toBe(401);
    // the legitimate new token and the second device are both dead now
    expect((await ctx.http().post('/auth/refresh').send({ refreshToken: r1.body.refreshToken })).status).toBe(401);
    expect((await ctx.http().post('/auth/refresh').send({ refreshToken: other.body.refreshToken })).status).toBe(401);
    expect((await ctx.http().get('/me').set('authorization', `Bearer ${r1.body.accessToken}`)).status).toBe(401);
  });

  it('logout ends the session and removes the push token', async () => {
    const s = await login(ctx);
    await ctx.http().post('/devices').set(s.auth).send({ fcmToken: 'fcm-token-for-this-phone-1234567890', platform: 'android' });
    const out = await ctx.http().post('/auth/logout').set(s.auth).send({ fcmToken: 'fcm-token-for-this-phone-1234567890' });
    expect(out.status).toBe(200);
    expect((await ctx.http().get('/me').set(s.auth)).status).toBe(401);
    expect((await ctx.http().post('/auth/refresh').send({ refreshToken: s.refreshToken })).status).toBe(401);
    expect(await ctx.deps.db.deviceToken.count({ where: { userId: s.userId } })).toBe(0);
  });
});

describe('profile', () => {
  it('T3: role, status and isLister cannot be set from the app', async () => {
    const { city } = await seedBasics(ctx.deps);
    const s = await login(ctx);
    for (const field of [{ status: 'ACTIVE' }, { isLister: true }, { role: 'ADMIN' }, { idVerified: true }, { phone: '+919999999999' }]) {
      const res = await ctx.http().patch('/me').set(s.auth).send({ name: 'Asha', cityId: city.id, ...field });
      expect(res.status).toBe(400);
    }
    const u = await ctx.deps.db.user.findUniqueOrThrow({ where: { id: s.userId } });
    expect(u.isLister).toBe(false);
    expect(u.idVerified).toBe(false);
  });

  it('only lets people pick an open city and a sensible name', async () => {
    const { closed, city } = await seedBasics(ctx.deps);
    const s = await login(ctx);
    expect((await ctx.http().patch('/me').set(s.auth).send({ cityId: closed.id })).status).toBe(400);
    expect((await ctx.http().patch('/me').set(s.auth).send({ name: 'call 9876543210' })).status).toBe(400);
    expect((await ctx.http().patch('/me').set(s.auth).send({ name: 'https://spam.example' })).status).toBe(400);
    const ok = await ctx.http().patch('/me').set(s.auth).send({ name: 'Dr. Meera Iyer', cityId: city.id, language: 'hi' });
    expect(ok.status).toBe(200);
    expect(ok.body.language).toBe('hi');
    const hindi = await ctx.http().patch('/me').set(s.auth).send({ name: 'सुनील कुमार' });
    expect(hindi.status).toBe(200);
  });

  it('waitlist: one entry per user and city, login required', async () => {
    const { closed } = await seedBasics(ctx.deps);
    expect((await ctx.http().post(`/cities/${closed.id}/waitlist`)).status).toBe(401);
    const s = await login(ctx);
    expect((await ctx.http().post(`/cities/${closed.id}/waitlist`).set(s.auth)).status).toBe(200);
    expect((await ctx.http().post(`/cities/${closed.id}/waitlist`).set(s.auth)).status).toBe(200);
    expect(await ctx.deps.db.cityWaitlist.count({ where: { cityId: closed.id } })).toBe(1);
  });
});

describe('App Check enforcement (T20)', () => {
  it('rejects protected calls without a valid token when enforced', async () => {
    const strict = await setupCtx({ APP_CHECK_ENFORCE: 'true' });
    try {
      const res = await strict.http().post('/auth/firebase').set('x-device-id', newDevice()).send({ idToken: `dev:${newPhone()}` });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('APP_CHECK_FAILED');
      const bad = await strict.http().post('/auth/firebase').set('x-firebase-appcheck', 'forged').send({ idToken: `dev:${newPhone()}` });
      expect(bad.status).toBe(403);
    } finally {
      await closeCtx(strict);
    }
  });
});
