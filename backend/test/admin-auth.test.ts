import { authenticator } from 'otplib';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_ORIGIN, adminLogin, closeCtx, login, makeAdmin, resetDb, setupCtx, stepUp, totp, type Ctx } from './helpers.ts';

let ctx: Ctx;
beforeAll(async () => {
  ctx = await setupCtx();
});
afterAll(async () => closeCtx(ctx));
beforeEach(async () => {
  await resetDb(ctx.deps);
});

const ADMIN_GETS = [
  '/admin/dashboard', '/admin/payments', '/admin/plans', '/admin/coupons', '/admin/listings', '/admin/reports', '/admin/users',
  '/admin/cities', '/admin/categories', '/admin/push', '/admin/insights', '/admin/settings', '/admin/id-verifications', '/admin/audit',
  '/admin/admins', '/admin/plan-requests',
];

const cookieFrom = (res: { headers: Record<string, unknown> }) =>
  ((res.headers['set-cookie'] as string[] | undefined) ?? []).find((c) => c.startsWith('rn_admin='))!;

describe('admin access', () => {
  it('T2: every admin route refuses an app user token and no session', async () => {
    const user = await login(ctx);
    for (const path of ADMIN_GETS) {
      expect((await ctx.http().get(path)).status, path).toBe(401);
      expect((await ctx.http().get(path).set(user.auth)).status, path).toBe(401);
    }
    const write = await ctx.http().post('/admin/payments/00000000-0000-4000-8000-000000000000/approve').set(user.auth).set('origin', ADMIN_ORIGIN);
    expect(write.status).toBe(401);
  });

  it('cannot get in with the password alone', async () => {
    const { email, password } = await makeAdmin(ctx);
    const r1 = await ctx.http().post('/admin/auth/login').set('origin', ADMIN_ORIGIN).send({ email, password });
    expect(r1.status).toBe(200);
    expect(r1.body.stage).toBe('2fa');
    const cookie = cookieFrom(r1).split(';')[0]!;
    const dash = await ctx.http().get('/admin/dashboard').set('cookie', cookie);
    expect(dash.status).toBe(401);
    expect(dash.body.error.code).toBe('MFA_REQUIRED');
  });

  it('sets HttpOnly, SameSite=Strict session cookies', async () => {
    const { email, password } = await makeAdmin(ctx);
    const r1 = await ctx.http().post('/admin/auth/login').set('origin', ADMIN_ORIGIN).send({ email, password });
    const c = cookieFrom(r1);
    expect(c).toMatch(/HttpOnly/i);
    expect(c).toMatch(/SameSite=Strict/i);
    expect(c).toMatch(/Path=\//);
  });

  it('uses one generic error for wrong email, wrong password and wrong code', async () => {
    const { email, password } = await makeAdmin(ctx);
    const a = await ctx.http().post('/admin/auth/login').set('origin', ADMIN_ORIGIN).send({ email: 'nobody@rentnook.test', password });
    const b = await ctx.http().post('/admin/auth/login').set('origin', ADMIN_ORIGIN).send({ email, password: 'wrong-password-123' });
    expect(a.status).toBe(401);
    expect(b.status).toBe(401);
    expect(a.body.error.message).toBe(b.body.error.message);
  });

  it('locks the account for 15 minutes after 5 failures', async () => {
    const { email, password } = await makeAdmin(ctx);
    for (let i = 0; i < 5; i++) {
      await ctx.http().post('/admin/auth/login').set('origin', ADMIN_ORIGIN).send({ email, password: `wrong-${i}-password` });
    }
    const right = await ctx.http().post('/admin/auth/login').set('origin', ADMIN_ORIGIN).send({ email, password });
    expect(right.status).toBe(423);
    const locked = await ctx.deps.db.auditLog.count({ where: { action: 'admin.locked' } });
    expect(locked).toBe(1);
  });

  it('a TOTP code cannot be replayed', async () => {
    const { email, password, secret } = await makeAdmin(ctx);
    const code = await totp(ctx, secret);
    const start = async () => ctx.http().post('/admin/auth/login').set('origin', ADMIN_ORIGIN).send({ email, password });
    const r1 = await start();
    const c1 = cookieFrom(r1).split(';')[0]!;
    const ok = await ctx.http().post('/admin/auth/2fa').set({ origin: ADMIN_ORIGIN, cookie: c1, 'x-csrf-token': r1.body.csrfToken }).send({ code });
    expect(ok.status).toBe(200);
    const r2 = await start();
    const c2 = cookieFrom(r2).split(';')[0]!;
    const again = await ctx.http().post('/admin/auth/2fa').set({ origin: ADMIN_ORIGIN, cookie: c2, 'x-csrf-token': r2.body.csrfToken }).send({ code });
    expect(again.status).toBe(401);
  });

  it('T14: changes without the CSRF token, or from another site, are blocked', async () => {
    const a = await adminLogin(ctx);
    const noToken = await ctx.http().post('/admin/cities').set({ cookie: a.cookie, origin: ADMIN_ORIGIN }).send({ name: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4, lng: 80.3 });
    expect(noToken.status).toBe(403);
    const evil = await ctx.http().post('/admin/cities').set({ cookie: a.cookie, 'x-csrf-token': a.csrf, origin: 'https://evil.example' }).send({ name: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4, lng: 80.3 });
    expect(evil.status).toBe(403);
    const noOrigin = await ctx.http().post('/admin/cities').set({ cookie: a.cookie, 'x-csrf-token': a.csrf }).send({ name: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4, lng: 80.3 });
    expect(noOrigin.status).toBe(403);
    const ok = await ctx.http().post('/admin/cities').set(a.headers).send({ name: 'Kanpur', state: 'Uttar Pradesh', lat: 26.4, lng: 80.3 });
    expect(ok.status).toBe(200);
  });

  it('idle sessions expire after 30 minutes', async () => {
    const a = await adminLogin(ctx);
    await ctx.deps.db.adminSession.updateMany({ where: { adminId: a.id }, data: { lastSeenAt: new Date(Date.now() - 31 * 60_000) } });
    expect((await ctx.http().get('/admin/dashboard').set(a.headers)).status).toBe(401);
  });

  it('first sign-in forces authenticator setup and returns backup codes once', async () => {
    const { email, password } = await makeAdmin(ctx);
    await ctx.deps.db.admin.update({ where: { email }, data: { totpEnabled: false, totpSecretEnc: null } });
    const r1 = await ctx.http().post('/admin/auth/login').set('origin', ADMIN_ORIGIN).send({ email, password });
    expect(r1.body.stage).toBe('totp-setup');
    const h = { origin: ADMIN_ORIGIN, cookie: cookieFrom(r1).split(';')[0]!, 'x-csrf-token': r1.body.csrfToken };
    const start = await ctx.http().post('/admin/auth/totp-setup/start').set(h);
    expect(start.status).toBe(200);
    expect(start.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    const confirm = await ctx.http().post('/admin/auth/totp-setup/confirm').set(h).send({ code: authenticator.generate(start.body.secret) });
    expect(confirm.status).toBe(200);
    expect(confirm.body.backupCodes).toHaveLength(10);
    const stored = await ctx.deps.db.admin.findUniqueOrThrow({ where: { email } });
    expect(stored.backupCodes.join()).not.toContain(confirm.body.backupCodes[0]);
  });
});

describe('roles', () => {
  it('ADMIN cannot open Super admin pages', async () => {
    const a = await adminLogin(ctx, 'ADMIN');
    for (const path of ['/admin/admins', '/admin/audit', '/admin/id-verifications']) {
      expect((await ctx.http().get(path).set(a.headers)).status, path).toBe(403);
    }
    const upi = await ctx.http().put('/admin/settings/upi').set(a.headers).send({ vpa: 'thief@okaxis', payeeName: 'Thief', qrKey: null });
    expect(upi.status).toBe(403);
  });

  it('changing the UPI ID needs a fresh 2-step code and is audit logged', async () => {
    const s = await adminLogin(ctx, 'SUPER_ADMIN');
    await ctx.deps.db.adminSession.updateMany({ where: { adminId: s.id }, data: { stepUpAt: new Date(Date.now() - 10 * 60_000) } });
    const body = { vpa: 'rentnookpay@okhdfcbank', payeeName: 'RentNook Pvt Ltd', qrKey: null };
    const blocked = await ctx.http().put('/admin/settings/upi').set(s.headers).send(body);
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('STEP_UP_REQUIRED');
    await stepUp(ctx, s);
    const ok = await ctx.http().put('/admin/settings/upi').set(s.headers).send(body);
    expect(ok.status).toBe(200);
    expect(await ctx.deps.db.auditLog.count({ where: { action: 'settings.upi' } })).toBe(1);
    const bad = await ctx.http().put('/admin/settings/upi').set(s.headers).send({ ...body, vpa: 'not a upi id' });
    expect(bad.status).toBe(400);
  });

  it('invites staff by link and the invite works once', async () => {
    const s = await adminLogin(ctx, 'SUPER_ADMIN');
    await stepUp(ctx, s);
    const inv = await ctx.http().post('/admin/admins').set(s.headers).send({ email: 'ops@rentnook.test', name: 'Ops Person', role: 'ADMIN' });
    expect(inv.status).toBe(200);
    const token = inv.body.inviteUrl.split('#')[1];
    const weak = await ctx.http().post('/admin/auth/accept-invite').set('origin', ADMIN_ORIGIN).send({ token, password: 'password1234' });
    expect(weak.status).toBe(400);
    const ok = await ctx.http().post('/admin/auth/accept-invite').set('origin', ADMIN_ORIGIN).send({ token, password: 'saffron-kettle-river-41' });
    expect(ok.status).toBe(200);
    const twice = await ctx.http().post('/admin/auth/accept-invite').set('origin', ADMIN_ORIGIN).send({ token, password: 'saffron-kettle-river-41' });
    expect(twice.status).toBe(404);
  });

  it('a disabled admin is logged out immediately', async () => {
    const s = await adminLogin(ctx, 'SUPER_ADMIN');
    const a = await adminLogin(ctx, 'ADMIN');
    await stepUp(ctx, s);
    const r = await ctx.http().patch(`/admin/admins/${a.id}`).set(s.headers).send({ disabled: true });
    expect(r.status).toBe(200);
    expect((await ctx.http().get('/admin/dashboard').set(a.headers)).status).toBe(401);
  });

  it('every admin write is in the audit log', async () => {
    const s = await adminLogin(ctx, 'SUPER_ADMIN');
    const c = await ctx.http().post('/admin/cities').set(s.headers).send({ name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.25, lng: 77.41 });
    await ctx.http().patch(`/admin/cities/${c.body.id}`).set(s.headers).send({ isOpen: true });
    await ctx.http().post('/admin/categories').set(s.headers).send({ name: 'Books', nameHi: 'किताबें', icon: 'book', sortOrder: 9 });
    const log = await ctx.http().get('/admin/audit').set(s.headers);
    const actions = log.body.items.map((i: { action: string }) => i.action);
    expect(actions).toEqual(expect.arrayContaining(['city.create', 'city.open', 'category.create', 'admin.login']));
  });

  it('audit rows cannot be edited or deleted, even directly in the database', async () => {
    await adminLogin(ctx, 'ADMIN');
    await expect(ctx.deps.db.auditLog.updateMany({ data: { action: 'nothing' } })).rejects.toThrow();
    await expect(ctx.deps.db.auditLog.deleteMany({})).rejects.toThrow();
  });
});
