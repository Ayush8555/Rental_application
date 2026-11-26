import { randomUUID } from 'node:crypto';
import { authenticator } from 'otplib';
import request from 'supertest';
import type { FastifyInstance } from 'fastify';
import { loadEnv } from '../src/config/env.ts';
import { createDeps, type Deps } from '../src/deps.ts';
import { buildApp } from '../src/app.ts';
import { InlineJobs } from '../src/jobs/queue.ts';
import { makeRunner } from '../src/jobs/handlers.ts';
import { encrypt } from '../src/lib/crypto.ts';
import { newReferralCode, newShortId } from '../src/lib/ids.ts';
import { addDays } from '../src/lib/time.ts';
import { hashPassword } from '../src/modules/admin/passwords.ts';
import { clearSettingsCache } from '../src/services/settings.ts';
import type { LogPush } from '../src/services/push.ts';

export interface Ctx {
  app: FastifyInstance;
  deps: Deps;
  jobs: InlineJobs;
  push: LogPush;
  http: () => ReturnType<typeof request>;
}

export const APP_CHECK = { 'x-firebase-appcheck': 'dev-app-check' };
export const ADMIN_ORIGIN = 'http://admin.test';

let deviceSeq = 0;
export const newDevice = () => `test-device-${process.pid}-${++deviceSeq}-${randomUUID().slice(0, 8)}`;

let phoneSeq = 0;
export const newPhone = () => `+9198${String(process.pid % 1000).padStart(3, '0')}${String(++phoneSeq).padStart(5, '0')}`;

export async function setupCtx(overrides: Record<string, string> = {}): Promise<Ctx> {
  const env = loadEnv({ ...process.env, ...overrides });
  const jobs = new InlineJobs();
  const deps = createDeps(env, jobs);
  jobs.bind(makeRunner(deps));
  const app = await buildApp(deps, { logger: false });
  await app.ready();
  return { app, deps, jobs, push: deps.push as LogPush, http: () => request(app.server) };
}

export async function resetDb(deps: Deps) {
  const tables = await deps.db.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await deps.db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(', ')} CASCADE`);
  await deps.redis.flushdb();
  clearSettingsCache();
}

export async function closeCtx(ctx: Ctx) {
  await ctx.app.close();
  await ctx.deps.db.$disconnect();
  ctx.deps.redis.disconnect();
}

// ---------------------------------------------------------------- fixtures

export async function seedBasics(deps: Deps) {
  const city = await deps.db.city.create({ data: { name: 'Lucknow', state: 'Uttar Pradesh', slug: `lucknow-${randomUUID().slice(0, 6)}`, isOpen: true, lat: 26.85, lng: 80.95 } });
  const closed = await deps.db.city.create({ data: { name: 'Pune', state: 'Maharashtra', slug: `pune-${randomUUID().slice(0, 6)}`, isOpen: false, lat: 18.52, lng: 73.85 } });
  const area = await deps.db.area.create({ data: { cityId: city.id, name: 'Gomti Nagar', lat: 26.8506, lng: 81.0012 } });
  const area2 = await deps.db.area.create({ data: { cityId: city.id, name: 'Aliganj', lat: 26.8936, lng: 80.9385 } });
  const closedArea = await deps.db.area.create({ data: { cityId: closed.id, name: 'Kothrud', lat: 18.5074, lng: 73.8077 } });
  const cameras = await deps.db.category.create({ data: { name: 'Cameras', nameHi: 'कैमरा', icon: 'camera', sortOrder: 1 } });
  const tools = await deps.db.category.create({ data: { name: 'Tools', nameHi: 'औज़ार', icon: 'wrench', sortOrder: 2 } });
  return { city, closed, area, area2, closedArea, cameras, tools };
}

export async function makePlan(deps: Deps, data: Partial<Parameters<Deps['db']['plan']['create']>[0]['data']> = {}) {
  return deps.db.plan.create({
    data: { name: 'Monthly', nameHi: 'मासिक', type: 'PAID', pricePaise: 29900, durationDays: 30, listingLimit: 5, ...data },
  });
}

export interface Session {
  userId: string;
  phone: string;
  device: string;
  accessToken: string;
  refreshToken: string;
  auth: Record<string, string>;
}

export async function login(ctx: Ctx, phone = newPhone(), device = newDevice()): Promise<Session> {
  const res = await ctx.http().post('/auth/firebase').set(APP_CHECK).set('x-device-id', device).send({ idToken: `dev:${phone}`, consentVersion: '2026-11' });
  if (res.status !== 200) throw new Error(`login failed ${res.status} ${JSON.stringify(res.body)}`);
  return {
    userId: res.body.user.id,
    phone,
    device,
    accessToken: res.body.accessToken,
    refreshToken: res.body.refreshToken,
    auth: { authorization: `Bearer ${res.body.accessToken}`, 'x-device-id': device, ...APP_CHECK },
  };
}

export async function loginWithProfile(ctx: Ctx, cityId: string, name = 'Rahul Verma') {
  const s = await login(ctx);
  const r = await ctx.http().patch('/me').set(s.auth).send({ name, cityId });
  if (r.status !== 200) throw new Error(`profile failed ${JSON.stringify(r.body)}`);
  return s;
}

export async function giveActivePlan(deps: Deps, userId: string, listingLimit: number | null = 5, days = 30) {
  const plan = await makePlan(deps, { listingLimit });
  return deps.db.subscription.create({
    data: {
      userId, planId: plan.id, planName: plan.name, planNameHi: plan.nameHi, planType: plan.type, pricePaise: plan.pricePaise,
      durationDays: days, listingLimit, boostCredits: 0, shopPage: false, status: 'ACTIVE', startsAt: addDays(new Date(), -1), endsAt: addDays(new Date(), days),
    },
  });
}

export async function makeListing(deps: Deps, userId: string, f: { cityId: string; areaId: string; categoryId: string; title?: string; status?: 'LIVE' | 'DRAFT' | 'REVIEW'; minRentPaise?: number }) {
  return deps.db.listing.create({
    data: {
      shortId: newShortId(), userId, cityId: f.cityId, areaId: f.areaId, categoryId: f.categoryId,
      title: f.title ?? 'Canon 1500D with kit lens', description: 'Works well, comes with bag and a 32GB card. Pickup only.',
      rentDayPaise: f.minRentPaise ?? 45000, minRentPaise: f.minRentPaise ?? 45000, condition: 'GOOD', status: f.status ?? 'LIVE',
      approxLat: 26.85, approxLng: 81.0, publishedAt: new Date(),
    },
  });
}

export async function makeUserDirect(deps: Deps, cityId: string | null, phone = newPhone()) {
  return deps.db.user.create({ data: { phone, name: 'Test Owner', cityId, referralCode: newReferralCode() } });
}

// ---------------------------------------------------------------- admin

export interface AdminSessionInfo {
  id: string;
  cookie: string;
  csrf: string;
  secret: string;
  headers: Record<string, string>;
}

export async function makeAdmin(ctx: Ctx, role: 'ADMIN' | 'SUPER_ADMIN' = 'ADMIN') {
  const secret = authenticator.generateSecret(20);
  const email = `${role.toLowerCase()}-${randomUUID().slice(0, 8)}@rentnook.test`;
  const password = 'kite-harbour-lantern-92';
  const admin = await ctx.deps.db.admin.create({
    data: { email, name: role === 'ADMIN' ? 'Priya (ops)' : 'Daman Singh', role, passwordHash: await hashPassword(password), totpSecretEnc: encrypt(ctx.deps.env.TOTP_ENC_KEY, secret), totpEnabled: true },
  });
  return { admin, email, password, secret };
}

const cookieOf = (res: request.Response) => {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const c = raw?.find((x) => x.startsWith('rn_admin='));
  return c ? c.split(';')[0]! : '';
};

// TOTP codes are single-use inside their 30 s window. Tests log in many times
// a second, so the replay marker is cleared first (replay itself is covered
// by its own test in admin-auth.test.ts).
export async function totp(ctx: Ctx, secret: string) {
  const keys = await ctx.deps.redis.keys('totp-used:*');
  if (keys.length) await ctx.deps.redis.del(...keys);
  return authenticator.generate(secret);
}

export async function adminLogin(ctx: Ctx, role: 'ADMIN' | 'SUPER_ADMIN' = 'ADMIN'): Promise<AdminSessionInfo> {
  const { admin, email, password, secret } = await makeAdmin(ctx, role);
  const r1 = await ctx.http().post('/admin/auth/login').set('origin', ADMIN_ORIGIN).send({ email, password });
  if (r1.status !== 200) throw new Error(`admin login ${r1.status} ${JSON.stringify(r1.body)}`);
  const c1 = cookieOf(r1);
  const r2 = await ctx.http().post('/admin/auth/2fa').set('origin', ADMIN_ORIGIN).set('cookie', c1).set('x-csrf-token', r1.body.csrfToken).send({ code: await totp(ctx, secret) });
  if (r2.status !== 200) throw new Error(`admin 2fa ${r2.status} ${JSON.stringify(r2.body)}`);
  const cookie = cookieOf(r2);
  return { id: admin.id, cookie, csrf: r2.body.csrfToken, secret, headers: { cookie, 'x-csrf-token': r2.body.csrfToken, origin: ADMIN_ORIGIN } };
}

export async function stepUp(ctx: Ctx, a: AdminSessionInfo) {
  const r = await ctx.http().post('/admin/auth/step-up').set(a.headers).send({ code: await totp(ctx, a.secret) });
  if (r.status !== 200) throw new Error(`step-up ${r.status} ${JSON.stringify(r.body)}`);
}
