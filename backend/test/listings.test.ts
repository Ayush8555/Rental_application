import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { closeCtx, giveActivePlan, login, loginWithProfile, makeListing, makeUserDirect, resetDb, seedBasics, setupCtx, type Ctx } from './helpers.ts';

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

const item = () => ({
  title: 'Canon 1500D with 18-55 lens',
  description: 'Used for two weddings, all good. Comes with bag and 32GB card.',
  categoryId: base.cameras.id,
  areaId: base.area.id,
  rentDay: 450,
  deposit: 5000,
  condition: 'GOOD',
});

describe('create and edit', () => {
  it('without a plan the item is saved as a draft', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    const res = await ctx.http().post('/listings').set(s.auth).send({ ...item(), submit: false });
    expect(res.status).toBe(200);
    expect(res.body.listing.status).toBe('DRAFT');
  });

  it('removes phone numbers, links and emails from text with a warning', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    const res = await ctx.http().post('/listings').set(s.auth).send({
      ...item(),
      description: 'Call me on 98765 43210 or +91-9876543210, mail rahul@gmail.com, see www.mysite.in for more pics',
    });
    expect(res.status).toBe(200);
    expect(res.body.warnings).toContain('CONTACT_REMOVED');
    const d: string = res.body.listing.description;
    expect(d).not.toMatch(/9876/);
    expect(d).not.toContain('gmail');
    expect(d).not.toContain('mysite');
  });

  it('strips HTML so scripts never get stored (T13 source side)', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    const res = await ctx.http().post('/listings').set(s.auth).send({ ...item(), title: '<script>alert(1)</script> Canon camera' });
    expect(res.status).toBe(200);
    expect(res.body.listing.title).not.toContain('<');
  });

  it('enforces title, description and price rules', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    expect((await ctx.http().post('/listings').set(s.auth).send({ ...item(), title: 'Cam' })).status).toBe(400);
    expect((await ctx.http().post('/listings').set(s.auth).send({ ...item(), description: 'too short' })).status).toBe(400);
    expect((await ctx.http().post('/listings').set(s.auth).send({ ...item(), rentDay: undefined })).status).toBe(400);
    expect((await ctx.http().post('/listings').set(s.auth).send({ ...item(), rentDay: 2_000_000 })).status).toBe(400);
    expect((await ctx.http().post('/listings').set(s.auth).send({ ...item(), rentDay: 10.5 })).status).toBe(400);
  });

  it('T3: status, owner, counters and featured cannot be set by the app', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    for (const extra of [{ status: 'LIVE' }, { userId: s.userId }, { featuredUntil: '2030-01-01T00:00:00Z' }, { viewCount: 9999 }, { approxLat: 1 }]) {
      expect((await ctx.http().post('/listings').set(s.auth).send({ ...item(), ...extra })).status).toBe(400);
    }
  });

  it('goes live with a plan and respects the limit', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    await giveActivePlan(ctx.deps, s.userId, 1);
    await ctx.deps.db.user.update({ where: { id: s.userId }, data: { createdAt: new Date(Date.now() - 3 * 86_400_000) } });
    const upload = async () => {
      const u = await ctx.deps.db.upload.create({
        data: { userId: s.userId, purpose: 'listing', rawKey: `raw/listing/${crypto.randomUUID()}`, finalKey: `listing/${crypto.randomUUID()}.webp`, status: 'READY', width: 800, height: 600, hash: 'h', dhash: crypto.randomUUID().replace(/-/g, '').slice(0, 16), expiresAt: new Date(Date.now() + 86_400_000) },
      });
      return u.id;
    };
    const first = await ctx.http().post('/listings').set(s.auth).send({ ...item(), imageIds: [await upload()], submit: true });
    expect(first.body.listing.status).toBe('LIVE');
    const second = await ctx.http().post('/listings').set(s.auth).send({ ...item(), imageIds: [await upload()], submit: true });
    expect(second.body.listing.status).toBe('DRAFT');
    expect(second.body.message).toMatch(/limit/i);
  });

  it('T1: another user cannot read drafts, edit, delete or change status', async () => {
    const owner = await loginWithProfile(ctx, base.city.id);
    const other = await loginWithProfile(ctx, base.city.id, 'Someone Else');
    const draft = await makeListing(ctx.deps, owner.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id, status: 'DRAFT' });
    const live = await makeListing(ctx.deps, owner.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    expect((await ctx.http().get(`/listings/${draft.id}`).set(other.auth)).status).toBe(404);
    expect((await ctx.http().patch(`/listings/${live.id}`).set(other.auth).send({ title: 'Hacked title here' })).status).toBe(404);
    expect((await ctx.http().delete(`/listings/${live.id}`).set(other.auth)).status).toBe(404);
    expect((await ctx.http().post(`/listings/${live.id}/status`).set(other.auth).send({ action: 'pause' })).status).toBe(404);
    const mine = await ctx.http().get('/listings/mine').set(other.auth);
    expect(mine.body.items).toHaveLength(0);
    const still = await ctx.deps.db.listing.findUniqueOrThrow({ where: { id: live.id } });
    expect(still.status).toBe('LIVE');
    expect(still.title).toBe(live.title);
  });

  it('owner can mark rented out, available, pause and delete', async () => {
    const s = await loginWithProfile(ctx, base.city.id);
    await giveActivePlan(ctx.deps, s.userId, 5);
    const l = await makeListing(ctx.deps, s.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    await ctx.deps.db.listingImage.create({ data: { listingId: l.id, storageKey: 'listing/x.webp', width: 1, height: 1, sortOrder: 0, hash: 'x', dhash: '0' } });
    const step = (action: string) => ctx.http().post(`/listings/${l.id}/status`).set(s.auth).send({ action });
    expect((await step('rented_out')).body.listing.status).toBe('RENTED_OUT');
    expect((await step('available')).body.listing.status).toBe('LIVE');
    expect((await step('pause')).body.listing.status).toBe('HIDDEN');
    expect((await step('available')).body.listing.status).toBe('LIVE');
    expect((await ctx.http().delete(`/listings/${l.id}`).set(s.auth)).status).toBe(200);
    expect((await ctx.deps.db.listing.findUniqueOrThrow({ where: { id: l.id } })).status).toBe('REMOVED');
  });
});

describe('search', () => {
  async function fill() {
    const owner = await makeUserDirect(ctx.deps, base.city.id);
    await makeListing(ctx.deps, owner.id, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id, title: 'Canon 1500D camera', minRentPaise: 45000 });
    await makeListing(ctx.deps, owner.id, { cityId: base.city.id, areaId: base.area2.id, categoryId: base.tools.id, title: 'Bosch drill machine', minRentPaise: 15000 });
    await makeListing(ctx.deps, owner.id, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id, title: 'Nikon D7500 body', minRentPaise: 70000, status: 'DRAFT' });
    await makeListing(ctx.deps, owner.id, { cityId: base.closed.id, areaId: base.closedArea.id, categoryId: base.cameras.id, title: 'Canon in Pune', minRentPaise: 40000 });
    return owner;
  }

  it('returns only live items in open cities and filters work', async () => {
    await fill();
    const all = await ctx.http().get('/listings').query({ city: base.city.id });
    expect(all.status).toBe(200);
    expect(all.body.total).toBe(2);
    const cams = await ctx.http().get('/listings').query({ city: base.city.id, category: base.cameras.id });
    expect(cams.body.items.map((i: { title: string }) => i.title)).toEqual(['Canon 1500D camera']);
    const cheap = await ctx.http().get('/listings').query({ city: base.city.id, max: 200 });
    expect(cheap.body.items).toHaveLength(1);
    const text = await ctx.http().get('/listings').query({ city: base.city.id, q: 'drill' });
    expect(text.body.items[0].title).toBe('Bosch drill machine');
    const prefix = await ctx.http().get('/listings').query({ city: base.city.id, q: 'cano' });
    expect(prefix.body.total).toBe(1);
    const closed = await ctx.http().get('/listings').query({ city: base.closed.id });
    expect(closed.body.total).toBe(0);
    const price = await ctx.http().get('/listings').query({ city: base.city.id, sort: 'price' });
    expect(price.body.items[0].title).toBe('Bosch drill machine');
  });

  it('T10: page size is capped at 50', async () => {
    const owner = await makeUserDirect(ctx.deps, base.city.id);
    for (let i = 0; i < 55; i++) await makeListing(ctx.deps, owner.id, { cityId: base.city.id, areaId: base.area.id, categoryId: base.tools.id, title: `Tool number ${i} for rent` });
    const res = await ctx.http().get('/listings').query({ city: base.city.id, limit: 1000 });
    expect(res.body.items).toHaveLength(50);
    expect(res.body.nextCursor).toBeTruthy();
    const next = await ctx.http().get('/listings').query({ city: base.city.id, cursor: res.body.nextCursor });
    expect(next.body.items).toHaveLength(5);
    expect((await ctx.http().get('/listings').query({ city: base.city.id, cursor: 'garbage' })).status).toBe(400);
  });

  it('T18: no phone number or exact location anywhere in list or detail responses', async () => {
    const owner = await fill();
    const list = await ctx.http().get('/listings').query({ city: base.city.id });
    const raw = JSON.stringify(list.body);
    expect(raw).not.toContain(owner.phone.slice(3));
    expect(raw).not.toContain('"phone"');
    expect(raw).not.toContain('approxLat');
    const detail = await ctx.http().get(`/listings/${list.body.items[0].id}`);
    const d = JSON.stringify(detail.body);
    expect(d).not.toContain(owner.phone.slice(3));
    expect(d).not.toContain('"phone"');
    expect(d).not.toContain('whatsapp');
    const featured = await ctx.http().get('/listings/featured').query({ city: base.city.id });
    expect(JSON.stringify(featured.body)).not.toContain(owner.phone.slice(3));
  });

  it('T21: SQL-looking and very long input is handled safely', async () => {
    await fill();
    for (const q of ["' OR 1=1 --", "'; DROP TABLE \"Listing\"; --", '%_%', '\\', 'काफ़ी अच्छा कैमरा', 'a'.repeat(60)]) {
      const r = await ctx.http().get('/listings').query({ city: base.city.id, q });
      expect(r.status, q).toBe(200);
    }
    expect((await ctx.http().get('/listings').query({ city: base.city.id, q: 'a'.repeat(61) })).status).toBe(400);
    expect((await ctx.http().get('/listings').query({ city: "x' OR '1'='1" })).status).toBe(400);
    expect(await ctx.deps.db.listing.count()).toBe(4);
  });

  it('logs searches without any user id', async () => {
    await fill();
    const s = await login(ctx);
    await ctx.http().get('/listings').set(s.auth).query({ city: base.city.id, q: 'tent' });
    const rows = await ctx.deps.db.searchLog.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.resultCount).toBe(0);
    expect(JSON.stringify(rows[0])).not.toContain(s.userId);
  });

  it('counts a view once per viewer per day', async () => {
    const owner = await fill();
    const l = await ctx.deps.db.listing.findFirstOrThrow({ where: { userId: owner.id, status: 'LIVE', cityId: base.city.id } });
    const s = await login(ctx);
    for (let i = 0; i < 3; i++) await ctx.http().get(`/listings/${l.id}`).set(s.auth);
    expect((await ctx.deps.db.listing.findUniqueOrThrow({ where: { id: l.id } })).viewCount).toBe(1);
  });
});

describe('WhatsApp contact', () => {
  it('guests must sign in; signed-in users get a wa.me link', async () => {
    const owner = await makeUserDirect(ctx.deps, base.city.id);
    const l = await makeListing(ctx.deps, owner.id, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    expect((await ctx.http().post(`/listings/${l.id}/contact`)).status).toBe(401);
    const s = await login(ctx);
    const r = await ctx.http().post(`/listings/${l.id}/contact`).set(s.auth);
    expect(r.status).toBe(200);
    expect(r.body.whatsappUrl).toMatch(new RegExp(`^https://wa\\.me/${owner.phone.slice(1)}\\?text=`));
    expect((await ctx.deps.db.listing.findUniqueOrThrow({ where: { id: l.id } })).waClickCount).toBe(1);
  });

  it('T9: the 31st different owner in a day is refused', async () => {
    const s = await login(ctx);
    const ids: string[] = [];
    for (let i = 0; i < 31; i++) {
      const o = await makeUserDirect(ctx.deps, base.city.id);
      ids.push((await makeListing(ctx.deps, o.id, { cityId: base.city.id, areaId: base.area.id, categoryId: base.tools.id })).id);
    }
    for (let i = 0; i < 30; i++) {
      await ctx.deps.redis.del(`rl:contact-burst:${s.userId}`);
      expect((await ctx.http().post(`/listings/${ids[i]}/contact`).set(s.auth)).status).toBe(200);
    }
    const blocked = await ctx.http().post(`/listings/${ids[30]}/contact`).set(s.auth);
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe('CONTACT_LIMIT');
    // same owner again is fine: it is the same conversation
    expect((await ctx.http().post(`/listings/${ids[0]}/contact`).set(s.auth)).status).toBe(200);
  });

  it('blocked users cannot contact each other and do not see each other’s items', async () => {
    const owner = await login(ctx);
    const seeker = await login(ctx);
    const l = await makeListing(ctx.deps, owner.userId, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    expect((await ctx.http().post(`/blocks/${seeker.userId}`).set(owner.auth)).status).toBe(200);
    expect((await ctx.http().post(`/listings/${l.id}/contact`).set(seeker.auth)).status).toBe(403);
    const list = await ctx.http().get('/listings').set(seeker.auth).query({ city: base.city.id });
    expect(list.body.total).toBe(0);
  });
});

describe('reports and saved items', () => {
  it('3 reports from different people hide the item; same person cannot report twice', async () => {
    const owner = await makeUserDirect(ctx.deps, base.city.id);
    const l = await makeListing(ctx.deps, owner.id, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    const a = await login(ctx);
    expect((await ctx.http().post('/reports').set(a.auth).send({ listingId: l.id, reason: 'ADVANCE_PAYMENT' })).status).toBe(200);
    expect((await ctx.http().post('/reports').set(a.auth).send({ listingId: l.id, reason: 'FAKE_ITEM' })).status).toBe(409);
    for (let i = 0; i < 2; i++) {
      const r = await login(ctx);
      await ctx.http().post('/reports').set(r.auth).send({ listingId: l.id, reason: 'FAKE_ITEM', note: 'asked for advance' });
    }
    const after = await ctx.deps.db.listing.findUniqueOrThrow({ where: { id: l.id } });
    expect(after.status).toBe('HIDDEN');
    expect(after.hiddenReason).toBe('REPORTS');
  });

  it('saved list is per user', async () => {
    const owner = await makeUserDirect(ctx.deps, base.city.id);
    const l = await makeListing(ctx.deps, owner.id, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    const a = await login(ctx);
    const b = await login(ctx);
    await ctx.http().post(`/favorites/${l.id}`).set(a.auth);
    await ctx.http().post(`/favorites/${l.id}`).set(a.auth);
    expect((await ctx.http().get('/favorites').set(a.auth)).body.items).toHaveLength(1);
    expect((await ctx.http().get('/favorites').set(b.auth)).body.items).toHaveLength(0);
    await ctx.http().delete(`/favorites/${l.id}`).set(b.auth);
    expect((await ctx.http().get('/favorites').set(a.auth)).body.items).toHaveLength(1);
  });
});

describe('admin moderation', () => {
  it('a closed city hides its items everywhere at once', async () => {
    const { adminLogin } = await import('./helpers.ts');
    const a = await adminLogin(ctx);
    const owner = await makeUserDirect(ctx.deps, base.city.id);
    const l = await makeListing(ctx.deps, owner.id, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id });
    await ctx.http().patch(`/admin/cities/${base.city.id}`).set(a.headers).send({ isOpen: false });
    expect((await ctx.http().get('/listings').query({ city: base.city.id })).body.total).toBe(0);
    expect((await ctx.http().get(`/listings/${l.id}`)).status).toBe(404);
    await ctx.http().patch(`/admin/cities/${base.city.id}`).set(a.headers).send({ isOpen: true });
    expect((await ctx.http().get('/listings').query({ city: base.city.id })).body.total).toBe(1);
  });

  it('review queue: approve makes it live, reject needs a reason', async () => {
    const { adminLogin } = await import('./helpers.ts');
    const a = await adminLogin(ctx);
    const owner = await makeUserDirect(ctx.deps, base.city.id);
    await giveActivePlan(ctx.deps, owner.id, 5);
    const l = await makeListing(ctx.deps, owner.id, { cityId: base.city.id, areaId: base.area.id, categoryId: base.cameras.id, status: 'REVIEW' });
    const q = await ctx.http().get('/admin/listings').set(a.headers).query({ tab: 'review' });
    expect(q.body.items).toHaveLength(1);
    expect(JSON.stringify(q.body)).not.toContain(owner.phone.slice(3));
    expect((await ctx.http().post(`/admin/listings/${l.id}/action`).set(a.headers).send({ action: 'reject' })).status).toBe(400);
    expect((await ctx.http().post(`/admin/listings/${l.id}/action`).set(a.headers).send({ action: 'approve' })).body.status).toBe('LIVE');
  });
});
