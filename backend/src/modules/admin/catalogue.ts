import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../../deps.ts';
import { actorOf, requireAdmin, requireStepUp, requireSuper } from '../../plugins/admin-session.ts';
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.ts';
import { parse } from '../../lib/validate.ts';
import { audit } from '../../services/audit.ts';
import { Prisma } from '../../services/db.ts';
import { clearSettingsCache, getSettings, settingSchemas, SUPER_ADMIN_ONLY_KEYS, type SettingKey } from '../../services/settings.ts';
import { idParams, pageQuery, paging } from './common.ts';
import { closeCity, openCity } from '../../jobs/city.ts';

const cityBody = z
  .object({
    name: z.string().trim().min(2).max(60),
    nameHi: z.string().trim().max(60).nullable().optional(),
    state: z.string().trim().min(2).max(60),
    lat: z.number().min(6).max(38),
    lng: z.number().min(68).max(98),
  })
  .strict();

const areaBody = z.object({ cityId: z.uuid(), name: z.string().trim().min(2).max(60), lat: z.number().min(6).max(38), lng: z.number().min(68).max(98) }).strict();

const fieldDef = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{1,29}$/),
    label: z.string().trim().min(1).max(40),
    labelHi: z.string().trim().max(40).optional(),
    type: z.enum(['text', 'number', 'select']),
    options: z.array(z.string().trim().min(1).max(40)).max(30).optional(),
    required: z.boolean().optional(),
  })
  .strict();

const categoryBody = z
  .object({
    name: z.string().trim().min(2).max(40),
    nameHi: z.string().trim().min(1).max(40),
    icon: z.string().regex(/^[a-z0-9-]{2,40}$/, 'Use an icon name from the icon set'),
    sortOrder: z.number().int().min(0).max(1000),
    isActive: z.boolean().optional(),
    fieldsSchema: z.array(fieldDef).max(12).optional(),
  })
  .strict();

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const dup = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

export default async function adminCatalogueRoutes(app: FastifyInstance, deps: Deps) {
  // ------------------------------------------------------------ cities (W-03)

  app.get('/admin/cities', { preHandler: requireAdmin }, async () => {
    const cities = await deps.db.city.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { users: true, waitlist: true, areas: true } } } });
    const live = await deps.db.listing.groupBy({ by: ['cityId'], where: { status: 'LIVE' }, _count: true });
    const liveBy = new Map(live.map((l) => [l.cityId, l._count]));
    return {
      items: cities.map((c) => ({
        id: c.id, name: c.name, nameHi: c.nameHi, state: c.state, slug: c.slug, isOpen: c.isOpen, lat: c.lat, lng: c.lng,
        openedAt: c.openedAt, liveItems: liveBy.get(c.id) ?? 0, users: c._count.users, waitlist: c._count.waitlist, areas: c._count.areas,
      })),
    };
  });

  app.post('/admin/cities', { preHandler: requireAdmin }, async (req) => {
    const body = parse(cityBody, req.body);
    try {
      const city = await deps.db.city.create({ data: { ...body, nameHi: body.nameHi ?? null, slug: `${slugify(body.name)}-${slugify(body.state)}` } });
      await audit(deps.db, actorOf(req), 'city.create', 'City', city.id, null, city);
      return city;
    } catch (e) {
      if (dup(e)) throw conflict('This city already exists in that state', 'DUPLICATE');
      throw e;
    }
  });

  app.patch('/admin/cities/:id', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(cityBody.partial().extend({ isOpen: z.boolean().optional() }).strict(), req.body);
    const before = await deps.db.city.findUnique({ where: { id } });
    if (!before) throw notFound();
    const { isOpen, ...rest } = body;
    let after = Object.keys(rest).length ? await deps.db.city.update({ where: { id }, data: rest }) : before;
    if (isOpen !== undefined && isOpen !== before.isOpen) {
      after = isOpen ? await openCity(deps, id) : await closeCity(deps, id);
    }
    await audit(deps.db, actorOf(req), isOpen === undefined ? 'city.update' : isOpen ? 'city.open' : 'city.close', 'City', id, before, after);
    return after;
  });

  app.get('/admin/areas', { preHandler: requireAdmin }, async (req) => {
    const { cityId } = parse(z.object({ cityId: z.uuid() }).strict(), req.query);
    const items = await deps.db.area.findMany({ where: { cityId }, orderBy: { name: 'asc' }, include: { _count: { select: { listings: true } } } });
    return { items: items.map((a) => ({ id: a.id, name: a.name, lat: a.lat, lng: a.lng, listings: a._count.listings })) };
  });

  app.post('/admin/areas', { preHandler: requireAdmin }, async (req) => {
    const body = parse(areaBody, req.body);
    try {
      const area = await deps.db.area.create({ data: body });
      await audit(deps.db, actorOf(req), 'area.create', 'Area', area.id, null, area);
      return area;
    } catch (e) {
      if (dup(e)) throw conflict('This area already exists in the city', 'DUPLICATE');
      throw e;
    }
  });

  app.patch('/admin/areas/:id', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(areaBody.omit({ cityId: true }).partial().strict(), req.body);
    const before = await deps.db.area.findUnique({ where: { id } });
    if (!before) throw notFound();
    const after = await deps.db.area.update({ where: { id }, data: body });
    await audit(deps.db, actorOf(req), 'area.update', 'Area', id, before, after);
    return after;
  });

  app.get('/admin/cities/:id/waitlist', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const count = await deps.db.cityWaitlist.count({ where: { cityId: id } });
    const recent = await deps.db.cityWaitlist.findMany({ where: { cityId: id }, orderBy: { createdAt: 'desc' }, take: 20, include: { user: { select: { name: true } } } });
    // Names only. Numbers are not listed in bulk anywhere in admin.
    return { count, recent: recent.map((r) => ({ name: r.user.name, createdAt: r.createdAt, notifiedAt: r.notifiedAt })) };
  });

  // ------------------------------------------------------------ categories (W-04)

  app.get('/admin/categories', { preHandler: requireAdmin }, async () => {
    const items = await deps.db.category.findMany({ orderBy: { sortOrder: 'asc' }, include: { _count: { select: { listings: true } } } });
    return { items: items.map(({ _count, ...c }) => ({ ...c, listings: _count.listings })) };
  });

  app.post('/admin/categories', { preHandler: requireAdmin }, async (req) => {
    const body = parse(categoryBody, req.body);
    try {
      const c = await deps.db.category.create({ data: { ...body, fieldsSchema: body.fieldsSchema ?? [] } });
      await audit(deps.db, actorOf(req), 'category.create', 'Category', c.id, null, c);
      return c;
    } catch (e) {
      if (dup(e)) throw conflict('Another category already uses this order number', 'DUPLICATE_ORDER');
      throw e;
    }
  });

  app.patch('/admin/categories/:id', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const body = parse(categoryBody.partial().strict(), req.body);
    const before = await deps.db.category.findUnique({ where: { id } });
    if (!before) throw notFound();
    try {
      const after = await deps.db.category.update({ where: { id }, data: body });
      await audit(deps.db, actorOf(req), 'category.update', 'Category', id, before, after);
      return after;
    } catch (e) {
      if (dup(e)) throw conflict('Another category already uses this order number', 'DUPLICATE_ORDER');
      throw e;
    }
  });

  // ------------------------------------------------------------ settings (W-13)

  app.get('/admin/settings', { preHandler: requireAdmin }, async (req) => {
    const s = await getSettings(deps.db);
    const upiQr = s.upi.qrKey ? await deps.storage.signGet('photos', s.upi.qrKey, 600) : null;
    return { values: s, upiQrUrl: upiQr, superOnly: SUPER_ADMIN_ONLY_KEYS, canEditAll: req.admin!.role === 'SUPER_ADMIN' };
  });

  app.put('/admin/settings/:key', { preHandler: requireAdmin }, async (req) => {
    const { key } = parse(z.object({ key: z.enum(Object.keys(settingSchemas) as [SettingKey, ...SettingKey[]]) }).strict(), req.params);
    // W-13 is a Super admin page; ADMIN may only tune moderation on/off and help text.
    const adminAllowed: SettingKey[] = ['moderation', 'help'];
    if (req.admin!.role !== 'SUPER_ADMIN' && !adminAllowed.includes(key)) throw forbidden('Only a Super admin can change this', 'SUPER_ADMIN_ONLY');
    if (key === 'upi') await requireStepUp(req);
    const value = parse(settingSchemas[key], req.body);
    const before = (await getSettings(deps.db))[key];
    if (key === 'upi') {
      const qrKey = (value as { qrKey: string | null }).qrKey;
      if (qrKey && !qrKey.startsWith('listing/') && !qrKey.startsWith('logo/')) throw badRequest('Upload the QR image again', 'BAD_QR');
    }
    await deps.db.setting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, updatedById: req.admin!.id },
      update: { value: value as Prisma.InputJsonValue, updatedById: req.admin!.id },
    });
    clearSettingsCache();
    await audit(deps.db, actorOf(req), `settings.${key}`, 'Setting', key, before, value);
    return { ok: true };
  });

  // Upload helper for the QR image: admin gets a signed URL, same pipeline as photos.
  app.post('/admin/settings/qr-upload', { preHandler: [requireSuper, requireStepUp] }, async (req) => {
    const body = parse(z.object({ contentType: z.enum(['image/png', 'image/jpeg', 'image/webp']), sizeBytes: z.number().int().min(100).max(2_000_000) }).strict(), req.body);
    const { randomUUID } = await import('node:crypto');
    const rawKey = `raw/admin-qr/${randomUUID()}`;
    const signed = await deps.storage.signPut('private', rawKey, body.contentType, 600, body.sizeBytes);
    const token = Buffer.from(rawKey).toString('base64url');
    return { ...signed, token };
  });

  app.post('/admin/settings/qr-complete', { preHandler: [requireSuper, requireStepUp] }, async (req) => {
    const { token } = parse(z.object({ token: z.string().max(200) }).strict(), req.body);
    const rawKey = Buffer.from(token, 'base64url').toString('utf8');
    if (!/^raw\/admin-qr\/[0-9a-f-]{36}$/.test(rawKey)) throw badRequest('Upload again', 'BAD_TOKEN');
    const raw = await deps.storage.get('private', rawKey);
    if (!raw) throw badRequest('Upload did not finish', 'NOT_UPLOADED');
    const { processImage } = await import('../../services/images.ts');
    const result = await processImage(raw, { maxSide: 1000, maxBytes: 2_000_000 });
    await deps.storage.remove('private', rawKey);
    if ('reject' in result) throw badRequest('This file is not a valid image', result.reject);
    const { randomUUID } = await import('node:crypto');
    const key = `logo/upi-qr-${randomUUID()}.webp`;
    await deps.storage.put('photos', key, result.data, 'image/webp');
    return { qrKey: key, url: await deps.storage.signGet('photos', key, 600) };
  });

  // ------------------------------------------------------------ audit log (W-05)

  app.get('/admin/audit', { preHandler: requireSuper }, async (req) => {
    const q = parse(
      z
        .object({
          ...pageQuery,
          actorId: z.uuid().optional(),
          action: z.string().max(60).optional(),
          from: z.iso.date().optional(),
          to: z.iso.date().optional(),
        })
        .strict(),
      req.query,
    );
    const where: Prisma.AuditLogWhereInput = {
      actorId: q.actorId,
      action: q.action ? { startsWith: q.action } : undefined,
      createdAt: q.from || q.to ? { gte: q.from ? new Date(q.from) : undefined, lt: q.to ? new Date(new Date(q.to).getTime() + 86_400_000) : undefined } : undefined,
    };
    const [items, total, admins] = await Promise.all([
      deps.db.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...paging(q) }),
      deps.db.auditLog.count({ where }),
      deps.db.admin.findMany({ select: { id: true, name: true } }),
    ]);
    const names = new Map(admins.map((a) => [a.id, a.name]));
    return { items: items.map((i) => ({ ...i, actorName: i.actorId ? (names.get(i.actorId) ?? 'Unknown') : 'System' })), total, admins };
  });
}
