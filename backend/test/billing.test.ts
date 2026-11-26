import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runPlanExpiry, runPaymentsCleanup } from '../src/jobs/handlers.ts';
import { addDays } from '../src/lib/time.ts';
import { adminLogin, closeCtx, login, loginWithProfile, makeListing, makePlan, newDevice, resetDb, seedBasics, setupCtx, stepUp, type AdminSessionInfo, type Ctx, type Session } from './helpers.ts';

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
  admin = await adminLogin(ctx, 'ADMIN');
});

async function buy(s: Session, planId: string, couponCode?: string) {
  return ctx.http().post('/subscriptions').set(s.auth).send({ planId, ...(couponCode ? { couponCode } : {}) });
}

async function pay(s: Session, paymentId: string, utr: string) {
  return ctx.http().post(`/payments/${paymentId}/proof`).set(s.auth).send({ utr });
}

const approve = (paymentId: string, a = admin) => ctx.http().post(`/admin/payments/${paymentId}/approve`).set(a.headers).set('idempotency-key', randomUUID());

let utrSeq = 0;
const newUtr = () => `4${String(Date.now()).slice(-7)}${String(++utrSeq).padStart(4, '0')}`;

describe('paid plans and UPI', () => {
  it('full loop: buy → UPI link from server values → UTR → approve → plan active + push', async () => {
    const plan = await makePlan(ctx.deps, { pricePaise: 79900 });
    const s = await loginWithProfile(ctx, base.city.id);
    await ctx.http().post('/devices').set(s.auth).send({ fcmToken: 'fcm-token-abcdefghijklmnopqrstuvwxyz', platform: 'android' });
    const b = await buy(s, plan.id);
    expect(b.status).toBe(200);
    expect(b.body.payment.amountPaise).toBe(79900);
    expect(b.body.payment.upi.upiLink).toMatch(/^upi:\/\/pay\?pa=rentnook%40okaxis&pn=RentNook&am=799&cu=INR&tn=RN-[A-Z0-9]{6}$/);
    const p = await pay(s, b.body.payment.id, newUtr());
    expect(p.status).toBe(200);
    expect(p.body.status).toBe('PENDING');
    const a = await approve(b.body.payment.id);
    expect(a.status).toBe(200);
    const sub = await ctx.deps.db.subscription.findFirstOrThrow({ where: { userId: s.userId } });
    expect(sub.status).toBe('ACTIVE');
    expect(ctx.push.outbox.some((m) => m.msg.title === 'Payment confirmed')).toBe(true);
    const mine = await ctx.http().get('/payments/mine').set(s.auth);
    expect(mine.body.items[0].status).toBe('APPROVED');
  });

  it('T5: the app cannot send its own amount', async () => {
    const plan = await makePlan(ctx.deps, { pricePaise: 79900 });
    const s = await loginWithProfile(ctx, base.city.id);
    const r = await ctx.http().post('/subscriptions').set(s.auth).send({ planId: plan.id, amountPaise: 100 });
    expect(r.status).toBe(400);
    const ok = await buy(s, plan.id);
    const proof = await ctx.http().post(`/payments/${ok.body.payment.id}/proof`).set(s.auth).send({ utr: newUtr(), amountPaise: 100 });
    expect(proof.status).toBe(400);
    const row = await ctx.deps.db.payment.findUniqueOrThrow({ where: { id: ok.body.payment.id } });
    expect(row.amountPaise).toBe(79900);
  });

  it('T4: the same UTR from a second account is rejected', async () => {
    const plan = await makePlan(ctx.deps);
    const a = await loginWithProfile(ctx, base.city.id);
    const b = await loginWithProfile(ctx, base.city.id);
    const utr = newUtr();
    const pa = await buy(a, plan.id);
    const pb = await buy(b, plan.id);
    expect((await pay(a, pa.body.payment.id, utr)).status).toBe(200);
    const dup = await pay(b, pb.body.payment.id, utr);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('UTR_USED');
  });

  it('a rejected UTR still cannot be reused by anyone else', async () => {
    const plan = await makePlan(ctx.deps);
    const a = await loginWithProfile(ctx, base.city.id);
    const b = await loginWithProfile(ctx, base.city.id);
    const utr = newUtr();
    const pa = await buy(a, plan.id);
    await pay(a, pa.body.payment.id, utr);
    const rej = await ctx.http().post(`/admin/payments/${pa.body.payment.id}/reject`).set(admin.headers).send({ reason: 'UTR not found in bank statement' });
    expect(rej.status).toBe(200);
    const pb = await buy(b, plan.id);
    expect((await pay(b, pb.body.payment.id, utr)).status).toBe(409);
    // the original payer can correct and resubmit
    expect((await pay(a, pa.body.payment.id, newUtr())).status).toBe(200);
  });

  it('UTR must be exactly 12 digits', async () => {
    const plan = await makePlan(ctx.deps);
    const s = await loginWithProfile(ctx, base.city.id);
    const b = await buy(s, plan.id);
    for (const utr of ['12345', '1234567890123', 'abcdefghijkl', '12345678901a']) {
      expect((await pay(s, b.body.payment.id, utr)).status, utr).toBe(400);
    }
  });

  it('T6: approving the same payment twice at once creates one subscription', async () => {
    const plan = await makePlan(ctx.deps);
    const s = await loginWithProfile(ctx, base.city.id);
    const b = await buy(s, plan.id);
    await pay(s, b.body.payment.id, newUtr());
    const admin2 = await adminLogin(ctx, 'ADMIN');
    const results = await Promise.all([approve(b.body.payment.id), approve(b.body.payment.id), approve(b.body.payment.id, admin2), approve(b.body.payment.id, admin2)]);
    const codes = results.map((r) => r.status).sort();
    expect(codes.filter((c) => c === 200)).toHaveLength(1);
    expect(codes.filter((c) => c === 409)).toHaveLength(3);
    expect(await ctx.deps.db.subscription.count({ where: { userId: s.userId, status: 'ACTIVE' } })).toBe(1);
  });

  it('the same idempotency key returns the first answer', async () => {
    const plan = await makePlan(ctx.deps);
    const s = await loginWithProfile(ctx, base.city.id);
    const b = await buy(s, plan.id);
    await pay(s, b.body.payment.id, newUtr());
    const key = randomUUID();
    const r1 = await ctx.http().post(`/admin/payments/${b.body.payment.id}/approve`).set(admin.headers).set('idempotency-key', key);
    const r2 = await ctx.http().post(`/admin/payments/${b.body.payment.id}/approve`).set(admin.headers).set('idempotency-key', key);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(r2.body).toEqual(r1.body);
  });

  it('max 3 payments waiting per user', async () => {
    const plan = await makePlan(ctx.deps);
    const s = await loginWithProfile(ctx, base.city.id);
    for (let i = 0; i < 3; i++) expect((await buy(s, plan.id)).status).toBe(200);
    const fourth = await buy(s, plan.id);
    expect(fourth.status).toBe(429);
    // unpaid ones expire after a day and free the slots
    await ctx.deps.db.payment.updateMany({ where: { userId: s.userId }, data: { createdAt: addDays(new Date(), -2) } });
    await runPaymentsCleanup(ctx.deps);
    expect((await buy(s, plan.id)).status).toBe(200);
  });

  it('a normal user cannot approve payments', async () => {
    const s = await login(ctx);
    const r = await ctx.http().post(`/admin/payments/${randomUUID()}/approve`).set(s.auth).set('origin', 'http://admin.test');
    expect(r.status).toBe(401);
  });
});

describe('free and trial plans', () => {
  it('T8: a free plan works once per person and per phone', async () => {
    const trial = await makePlan(ctx.deps, { name: 'Free trial', type: 'TRIAL', pricePaise: 0, durationDays: 15, listingLimit: 1, maxPerUser: 1 });
    const device = newDevice();
    const s = await login(ctx, undefined, device);
    await ctx.http().patch('/me').set(s.auth).send({ name: 'Ravi', cityId: base.city.id });
    const first = await buy(s, trial.id);
    expect(first.status).toBe(200);
    expect(first.body.subscription.status).toBe('ACTIVE');
    expect(first.body.payment).toBeNull();
    expect((await buy(s, trial.id)).status).toBe(409);
    // second account on the same phone
    const s2 = await login(ctx, undefined, device);
    await ctx.http().patch('/me').set(s2.auth).send({ name: 'Ravi Two', cityId: base.city.id });
    const again = await buy(s2, trial.id);
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('ALREADY_USED');
    // reinstall = same number, new install; still refused by account
    const s3 = await login(ctx, s.phone, newDevice());
    expect((await buy(s3, trial.id)).status).toBe(409);
  });

  it('parallel taps cannot activate a free plan twice', async () => {
    const trial = await makePlan(ctx.deps, { type: 'FREE', pricePaise: 0, maxPerUser: 1 });
    const s = await loginWithProfile(ctx, base.city.id);
    const rs = await Promise.all(Array.from({ length: 5 }, () => buy(s, trial.id)));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await ctx.deps.db.subscription.count({ where: { userId: s.userId, status: { notIn: ['REJECTED', 'CANCELLED'] } } })).toBe(1);
  });

  it('free plans can wait for admin approval', async () => {
    const plan = await makePlan(ctx.deps, { type: 'FREE', pricePaise: 0, maxPerUser: 1, needsApproval: true });
    const s = await loginWithProfile(ctx, base.city.id);
    const r = await buy(s, plan.id);
    expect(r.body.subscription.status).toBe('PENDING');
    const queue = await ctx.http().get('/admin/plan-requests').set(admin.headers);
    expect(queue.body.total).toBe(1);
    const ok = await ctx.http().post(`/admin/plan-requests/${r.body.subscription.id}`).set(admin.headers).send({ decision: 'approve' });
    expect(ok.body.status).toBe('ACTIVE');
  });

  it('hidden and out-of-window plans are not offered', async () => {
    await makePlan(ctx.deps, { name: 'Partner', visibility: 'HIDDEN' });
    await makePlan(ctx.deps, { name: 'Diwali', validTo: addDays(new Date(), -1) });
    await makePlan(ctx.deps, { name: 'Other city', allCities: false, cityIds: [base.closed.id] });
    const visible = await makePlan(ctx.deps, { name: 'Monthly' });
    const s = await loginWithProfile(ctx, base.city.id);
    const list = await ctx.http().get('/plans').set(s.auth);
    expect(list.body.items.map((p: { id: string }) => p.id)).toEqual([visible.id]);
    const hidden = await ctx.deps.db.plan.findFirstOrThrow({ where: { name: 'Partner' } });
    expect((await buy(s, hidden.id)).status).toBe(400);
  });
});

describe('plan rules (12.4)', () => {
  it('snapshot: editing a plan does not change existing subscriptions', async () => {
    const plan = await makePlan(ctx.deps, { listingLimit: 5, pricePaise: 29900 });
    const s = await loginWithProfile(ctx, base.city.id);
    const b = await buy(s, plan.id);
    await pay(s, b.body.payment.id, newUtr());
    await approve(b.body.payment.id);
    const body = { name: 'Monthly', nameHi: 'मासिक', type: 'PAID', pricePaise: 49900, durationDays: 10, listingLimit: 1, maxPerUser: null };
    expect((await ctx.http().put(`/admin/plans/${plan.id}`).set(admin.headers).send(body)).status).toBe(200);
    const sub = await ctx.deps.db.subscription.findFirstOrThrow({ where: { userId: s.userId } });
    expect(sub.listingLimit).toBe(5);
    expect(sub.pricePaise).toBe(29900);
    expect(sub.durationDays).toBe(30);
  });

  it('pending payment keeps the old price after a price change', async () => {
    const plan = await makePlan(ctx.deps, { pricePaise: 29900 });
    const s = await loginWithProfile(ctx, base.city.id);
    const b = await buy(s, plan.id);
    await ctx.http().put(`/admin/plans/${plan.id}`).set(admin.headers).send({ name: 'Monthly', nameHi: 'मासिक', type: 'PAID', pricePaise: 39900, durationDays: 30, listingLimit: 5, maxPerUser: null, visibility: 'ARCHIVED' });
    expect((await pay(s, b.body.payment.id, newUtr())).status).toBe(200);
    expect((await approve(b.body.payment.id)).status).toBe(200);
    const p = await ctx.deps.db.payment.findUniqueOrThrow({ where: { id: b.body.payment.id } });
    expect(p.amountPaise).toBe(29900);
  });

  it('a plan with buyers cannot be deleted, only archived', async () => {
    const plan = await makePlan(ctx.deps);
    const s = await loginWithProfile(ctx, base.city.id);
    await buy(s, plan.id);
    expect((await ctx.http().delete(`/admin/plans/${plan.id}`).set(admin.headers)).status).toBe(409);
  });

  it('stacking: same plan queues, bigger plan starts now with leftover days added', async () => {
    const small = await makePlan(ctx.deps, { listingLimit: 5, durationDays: 30 });
    const big = await makePlan(ctx.deps, { listingLimit: 15, durationDays: 90, pricePaise: 79900 });
    const s = await loginWithProfile(ctx, base.city.id);
    const buyAndApprove = async (planId: string) => {
      const b = await buy(s, planId);
      await pay(s, b.body.payment.id, newUtr());
      await approve(b.body.payment.id);
      return b.body.subscription.id as string;
    };
    const first = await buyAndApprove(small.id);
    const second = await buyAndApprove(small.id);
    const firstRow = await ctx.deps.db.subscription.findUniqueOrThrow({ where: { id: first } });
    const secondRow = await ctx.deps.db.subscription.findUniqueOrThrow({ where: { id: second } });
    expect(secondRow.status).toBe('SCHEDULED');
    expect(secondRow.startsAt!.getTime()).toBe(firstRow.endsAt!.getTime());

    const third = await buyAndApprove(big.id);
    const bigRow = await ctx.deps.db.subscription.findUniqueOrThrow({ where: { id: third } });
    expect(bigRow.status).toBe('ACTIVE');
    const days = (bigRow.endsAt!.getTime() - bigRow.startsAt!.getTime()) / 86_400_000;
    expect(Math.round(days)).toBe(120); // 90 + about 30 left over
    expect((await ctx.deps.db.subscription.findUniqueOrThrow({ where: { id: first } })).status).toBe('CANCELLED');
  });

  it('expiry hides items, renewal brings them back, job is idempotent and reminds once', async () => {
    const plan = await makePlan(ctx.deps, { listingLimit: 5 });
    const s = await loginWithProfile(ctx, base.city.id);
    const b = await buy(s, plan.id);
    await pay(s, b.body.payment.id, newUtr());
    await approve(b.body.payment.id);
    const l = await makeListing(ctx.deps, s.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });

    // 2 days left -> one "3 days" reminder, however often the job runs
    await ctx.deps.db.subscription.updateMany({ where: { userId: s.userId }, data: { endsAt: addDays(new Date(), 2) } });
    ctx.push.outbox.length = 0;
    await runPlanExpiry(ctx.deps);
    await runPlanExpiry(ctx.deps);
    const sub = await ctx.deps.db.subscription.findFirstOrThrow({ where: { userId: s.userId } });
    expect(sub.status).toBe('EXPIRING');
    expect(sub.remindersSent).toEqual([3]);
    expect(await ctx.deps.db.notification.count({ where: { userId: s.userId, type: 'PLAN_EXPIRING' } })).toBe(1);

    await ctx.deps.db.subscription.updateMany({ where: { userId: s.userId }, data: { endsAt: addDays(new Date(), -0.01) } });
    const r1 = await runPlanExpiry(ctx.deps);
    const r2 = await runPlanExpiry(ctx.deps);
    expect(r1.expired).toBe(1);
    expect(r2.expired).toBe(0);
    expect((await ctx.deps.db.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('HIDDEN');

    const renew = await buy(s, plan.id);
    await pay(s, renew.body.payment.id, newUtr());
    await approve(renew.body.payment.id);
    expect((await ctx.deps.db.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('LIVE');
  });

  it('a smaller plan moves the newest extra items to draft', async () => {
    const tiny = await makePlan(ctx.deps, { listingLimit: 1 });
    const s = await loginWithProfile(ctx, base.city.id);
    const old = await makeListing(ctx.deps, s.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    await ctx.deps.db.listing.update({ where: { id: old.id }, data: { publishedAt: addDays(new Date(), -5), status: 'HIDDEN', hiddenReason: 'PLAN_ENDED' } });
    const newer = await makeListing(ctx.deps, s.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    await ctx.deps.db.listing.update({ where: { id: newer.id }, data: { status: 'HIDDEN', hiddenReason: 'PLAN_ENDED' } });
    const b = await buy(s, tiny.id);
    await pay(s, b.body.payment.id, newUtr());
    await approve(b.body.payment.id);
    const statuses = await ctx.deps.db.listing.findMany({ where: { userId: s.userId }, orderBy: { publishedAt: 'asc' } });
    expect(statuses.filter((x) => x.status === 'LIVE')).toHaveLength(1);
  });
});

describe('coupons', () => {
  async function coupon(maxUses: number | null, perUserLimit = 1, value = 20) {
    const c = await ctx.http().post('/admin/coupons').set(admin.headers).send({
      code: `DIWALI${Math.floor(Math.random() * 1e6)}`, type: 'PERCENT', value, validFrom: addDays(new Date(), -1).toISOString(), validTo: addDays(new Date(), 5).toISOString(), maxUses, perUserLimit,
    });
    expect(c.status).toBe(200);
    return c.body as { id: string; code: string };
  }

  it('discount is computed by the server and checked again at approval', async () => {
    const plan = await makePlan(ctx.deps, { pricePaise: 50000 });
    const c = await coupon(10);
    const s = await loginWithProfile(ctx, base.city.id);
    const v = await ctx.http().post('/coupons/validate').set(s.auth).send({ planId: plan.id, couponCode: c.code.toLowerCase() });
    expect(v.body).toEqual({ discountPaise: 10000, totalPaise: 40000 });
    const b = await buy(s, plan.id, c.code);
    expect(b.body.payment.amountPaise).toBe(40000);
    await pay(s, b.body.payment.id, newUtr());
    await ctx.deps.db.coupon.update({ where: { id: c.id }, data: { maxUses: 0 } });
    const a = await approve(b.body.payment.id);
    expect(a.status).toBe(409);
    expect(a.body.error.code).toBe('COUPON_USED_UP');
  });

  it('T7: parallel approvals cannot use a coupon beyond its limit', async () => {
    const plan = await makePlan(ctx.deps, { pricePaise: 50000 });
    const c = await coupon(2);
    const payments: string[] = [];
    for (let i = 0; i < 5; i++) {
      const s = await loginWithProfile(ctx, base.city.id);
      const b = await buy(s, plan.id, c.code);
      expect(b.status).toBe(200);
      await pay(s, b.body.payment.id, newUtr());
      payments.push(b.body.payment.id);
    }
    const results = await Promise.all(payments.map((id) => approve(id)));
    expect(results.filter((r) => r.status === 200)).toHaveLength(2);
    expect((await ctx.deps.db.coupon.findUniqueOrThrow({ where: { id: c.id } })).usedCount).toBe(2);
    expect(await ctx.deps.db.couponUse.count({ where: { couponId: c.id } })).toBe(2);
  });

  it('per-user limit counts pending payments too', async () => {
    const plan = await makePlan(ctx.deps, { pricePaise: 50000 });
    const c = await coupon(null, 1);
    const s = await loginWithProfile(ctx, base.city.id);
    expect((await buy(s, plan.id, c.code)).status).toBe(200);
    const second = await buy(s, plan.id, c.code);
    expect(second.status).toBe(400);
    expect(second.body.error.code).toBe('COUPON_LIMIT');
  });
});

describe('admin powers', () => {
  it('ADMIN cannot give a paid plan for free; Super admin can with a fresh code', async () => {
    const plan = await makePlan(ctx.deps, { pricePaise: 79900 });
    const s = await loginWithProfile(ctx, base.city.id);
    const denied = await ctx.http().post(`/admin/users/${s.userId}/give-plan`).set(admin.headers).send({ planId: plan.id, reason: 'partner shop' });
    expect(denied.status).toBe(403);
    const sup = await adminLogin(ctx, 'SUPER_ADMIN');
    await stepUp(ctx, sup);
    const ok = await ctx.http().post(`/admin/users/${s.userId}/give-plan`).set(sup.headers).send({ planId: plan.id, reason: 'partner shop' });
    expect(ok.status).toBe(200);
    const log = await ctx.deps.db.auditLog.findFirstOrThrow({ where: { action: 'subscription.give' } });
    expect(JSON.stringify(log.after)).toContain('partner shop');
  });

  it('blocking a user logs them out and hides their items', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    const l = await makeListing(ctx.deps, s.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    const r = await ctx.http().post(`/admin/users/${s.userId}/block`).set(admin.headers).send({ reason: 'scam reports' });
    expect(r.status).toBe(200);
    expect((await ctx.http().get('/me').set(s.auth)).status).toBe(401);
    expect((await ctx.deps.db.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('HIDDEN');
  });

  it('user search never exposes full numbers; reveal is one at a time and logged', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    const list = await ctx.http().get('/admin/users').set(admin.headers).query({ q: s.phone.slice(-4) });
    expect(list.body.items).toHaveLength(1);
    expect(JSON.stringify(list.body)).not.toContain(s.phone);
    const rev = await ctx.http().post(`/admin/users/${s.userId}/reveal-phone`).set(admin.headers).send({ why: 'payment query on call' });
    expect(rev.body.phone).toBe(s.phone);
    expect(await ctx.deps.db.auditLog.count({ where: { action: 'user.reveal_phone' } })).toBe(1);
  });

  it('dashboard numbers match the database', async () => {
    const plan = await makePlan(ctx.deps, { pricePaise: 29900 });
    const s = await loginWithProfile(ctx, base.city.id);
    const b = await buy(s, plan.id);
    await pay(s, b.body.payment.id, newUtr());
    await approve(b.body.payment.id);
    const d = await ctx.http().get('/admin/dashboard').set(admin.headers);
    expect(d.body.revenueThisMonthPaise).toBe(29900);
    expect(d.body.activeListers).toBe(1);
    expect(d.body.users).toBe(await ctx.deps.db.user.count({ where: { status: 'ACTIVE' } }));
  });
});

describe('boosts', () => {
  it('boost via payment shows the item as sponsored after approval; city cap queues the rest', async () => {
    await ctx.deps.db.setting.create({ data: { key: 'limits', value: { contactsPerDay: 30, reportsToHide: 3, sponsoredPerCity: 1, pendingPaymentsMax: 3, utrPerDay: 10, requestsPerDay: 5, referralRewardsPerMonth: 5, referralRewardDays: 15, newAccountListingsFirstDay: 3, broadcastsPerDay: 3 } } });
    const { clearSettingsCache } = await import('../src/services/settings.ts');
    clearSettingsCache();
    const boostOne = async () => {
      const s = await loginWithProfile(ctx, base.city.id);
      const l = await makeListing(ctx.deps, s.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
      const r = await ctx.http().post(`/listings/${l.id}/boost`).set(s.auth).send({ days: 3 });
      expect(r.status).toBe(200);
      expect(r.body.payment.amountPaise).toBe(4900);
      await pay(s, r.body.payment.id, newUtr());
      await approve(r.body.payment.id);
      return l.id;
    };
    const first = await boostOne();
    const second = await boostOne();
    const featured = await ctx.http().get('/listings/featured').query({ city: base.city.id });
    expect(featured.body.items.map((i: { id: string }) => i.id)).toEqual([first]);
    expect((await ctx.deps.db.boost.findFirstOrThrow({ where: { listingId: second } })).status).toBe('QUEUED');
  });

  it('only the owner can boost, and only live items', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    const other = await loginWithProfile(ctx, base.city.id);
    const l = await makeListing(ctx.deps, s.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id, status: 'DRAFT' });
    expect((await ctx.http().post(`/listings/${l.id}/boost`).set(other.auth).send({ days: 3 })).status).toBe(404);
    expect((await ctx.http().post(`/listings/${l.id}/boost`).set(s.auth).send({ days: 3 })).status).toBe(400);
    expect((await ctx.http().post(`/listings/${l.id}/boost`).set(s.auth).send({ days: 4 })).status).toBe(400);
  });
});

describe('referrals', () => {
  it('two accounts on one phone cannot farm rewards', async () => {
    const device = newDevice();
    const referrer = await login(ctx, undefined, device);
    const code = (await ctx.http().get('/referral').set(referrer.auth)).body.code;
    const sameDevice = await login(ctx, undefined, device);
    const r = await ctx.http().post('/referral/apply').set(sameDevice.auth).send({ code });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('SAME_DEVICE');
    expect((await ctx.http().post('/referral/apply').set(referrer.auth).send({ code })).body.error.code).toBe('OWN_CODE');
  });

  it('reward only after the friend’s first approved paid payment', async () => {
    const plan = await makePlan(ctx.deps, { pricePaise: 29900 });
    const referrer = await loginWithProfile(ctx, base.city.id);
    const code = (await ctx.http().get('/referral').set(referrer.auth)).body.code;
    const friend = await loginWithProfile(ctx, base.city.id);
    expect((await ctx.http().post('/referral/apply').set(friend.auth).send({ code })).status).toBe(200);
    expect((await ctx.http().post('/referral/apply').set(friend.auth).send({ code })).status).toBe(409);
    expect((await ctx.deps.db.referral.findFirstOrThrow()).status).toBe('PENDING');
    const b = await buy(friend, plan.id);
    await pay(friend, b.body.payment.id, newUtr());
    await approve(b.body.payment.id);
    expect((await ctx.deps.db.referral.findFirstOrThrow()).status).toBe('REWARDED');
    const u = await ctx.deps.db.user.findUniqueOrThrow({ where: { id: referrer.userId } });
    expect(u.rewardDaysBank).toBe(15);
  });
});
