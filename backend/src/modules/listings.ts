import { z } from 'zod';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Deps } from '../deps.ts';
import { currentUser, makeAppCheckGuard, requireUser } from '../plugins/auth.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { clampLimit, decodeCursor, encodeCursor } from '../lib/cursor.ts';
import { badRequest, conflict, forbidden, notFound, tooMany } from '../lib/errors.ts';
import { roundCoord } from '../lib/geo.ts';
import { newShortId } from '../lib/ids.ts';
import { normalisePhone } from '../lib/phone.ts';
import { cleanListingText } from '../lib/text-filter.ts';
import { DAY_MS, istDay } from '../lib/time.ts';
import { parse } from '../lib/validate.ts';
import { Prisma, type Category, type ListingStatus } from '../services/db.ts';
import { getSetting, getSettings } from '../services/settings.ts';
import { claimUploads } from './uploads.ts';
import { listingCapacity } from './subscription-state.ts';
import { moderationFlags } from './moderation.ts';
import { cardInclude, serializeCard, serializeDetail, serializeOwnListing, type Origin } from './serializers.ts';

// ---------------------------------------------------------------- input rules (section 14)

const rupees = z
  .number()
  .int('Use whole rupees')
  .min(1)
  .max(1_000_000)
  .transform((r) => r * 100);

const baseFields = {
  title: z.string().trim().min(8, 'Title must be at least 8 characters').max(80),
  description: z.string().trim().min(20, 'Description must be at least 20 characters').max(1000),
  categoryId: z.uuid(),
  areaId: z.uuid(),
  rentDay: rupees.nullable().optional(),
  rentWeek: rupees.nullable().optional(),
  rentMonth: rupees.nullable().optional(),
  deposit: rupees.nullable().optional(),
  condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']),
  extra: z.record(z.string().max(40), z.union([z.string().max(100), z.number(), z.boolean()])).optional(),
  whatsappPhone: z.string().max(16).nullable().optional(),
  imageIds: z.array(z.uuid()).max(8).optional(),
  submit: z.boolean().optional(),
};

const createBody = z.object(baseFields).strict();
const patchBody = z
  .object({
    ...baseFields,
    title: baseFields.title.optional(),
    description: baseFields.description.optional(),
    categoryId: baseFields.categoryId.optional(),
    areaId: baseFields.areaId.optional(),
    condition: baseFields.condition.optional(),
  })
  .strict();

const statusBody = z.object({ action: z.enum(['submit', 'rented_out', 'available', 'pause']) }).strict();

const searchQuery = z
  .object({
    city: z.uuid(),
    q: z.string().trim().max(60).optional(),
    category: z.uuid().optional(),
    area: z.uuid().optional(),
    min: z.coerce.number().int().min(0).max(1_000_000).optional(),
    max: z.coerce.number().int().min(0).max(1_000_000).optional(),
    period: z.enum(['day', 'week', 'month']).optional(),
    verified: z.enum(['true', 'false']).optional(),
    sort: z.enum(['nearest', 'newest', 'price']).default('newest'),
    lat: z.coerce.number().min(6).max(38).optional(),
    lng: z.coerce.number().min(68).max(98).optional(),
    cursor: z.string().max(200).optional(),
    limit: z.coerce.number().int().optional(),
  })
  .strict();

type ExtraField = { key: string; label?: string; type: 'text' | 'number' | 'select'; options?: string[]; required?: boolean };

function checkExtra(category: Category, extra: Record<string, unknown> | undefined) {
  const fields = (Array.isArray(category.fieldsSchema) ? category.fieldsSchema : []) as ExtraField[];
  const out: Record<string, string | number> = {};
  const known = new Map(fields.map((f) => [f.key, f]));
  for (const [k, v] of Object.entries(extra ?? {})) {
    const f = known.get(k);
    if (!f) continue; // unknown extra keys are dropped, not stored
    if (f.type === 'number') {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw badRequest(`${f.label ?? k} must be a number`, 'BAD_EXTRA');
      out[k] = n;
    } else if (f.type === 'select') {
      if (typeof v !== 'string' || !f.options?.includes(v)) throw badRequest(`Choose ${f.label ?? k} from the list`, 'BAD_EXTRA');
      out[k] = v;
    } else {
      out[k] = cleanListingText(String(v)).text.slice(0, 100);
    }
  }
  for (const f of fields) if (f.required && out[f.key] === undefined) throw badRequest(`${f.label ?? f.key} is required`, 'BAD_EXTRA');
  return out;
}

const minRent = (d?: number | null, w?: number | null, m?: number | null) => {
  const values = [d, w, m].filter((v): v is number => typeof v === 'number');
  return values.length ? Math.min(...values) : null;
};

// Decides where a submitted item goes: LIVE, REVIEW, or back to DRAFT with a reason.
async function decideStatus(deps: Deps, userId: string, flags: string[], excludeListingId?: string) {
  const cap = await listingCapacity(deps.db, userId);
  const usedNow = excludeListingId
    ? cap.used - (await deps.db.listing.count({ where: { id: excludeListingId, status: { in: ['LIVE', 'REVIEW', 'RENTED_OUT'] } } }))
    : cap.used;
  if (!cap.hasPlan) return { status: 'DRAFT' as ListingStatus, reason: 'NEEDS_PLAN' };
  if (cap.limit !== null && usedNow >= cap.limit) return { status: 'DRAFT' as ListingStatus, reason: 'LIMIT_REACHED' };
  const moderation = await getSetting(deps.db, 'moderation');
  if (moderation.reviewNewItems || flags.length) return { status: 'REVIEW' as ListingStatus, reason: null };
  return { status: 'LIVE' as ListingStatus, reason: null };
}

const DRAFT_MESSAGES: Record<string, string> = {
  NEEDS_PLAN: 'Saved as draft. Choose a plan to go live.',
  LIMIT_REACHED: 'Saved as draft. Your plan limit is full — upgrade or pause another item.',
  CITY_CLOSED: 'Saved as draft. Your city is closed for now.',
};

async function loadOwn(deps: Deps, userId: string, id: string) {
  // Filter by owner in the query itself (not after loading) so another
  // user's id simply "does not exist" for this caller.
  const listing = await deps.db.listing.findFirst({ where: { id, userId, status: { not: 'REMOVED' } } });
  if (!listing) throw notFound('Item not found');
  return listing;
}

function originFrom(q: { lat?: number; lng?: number }, fallback: Origin | null): Origin | null {
  if (q.lat !== undefined && q.lng !== undefined) return { lat: roundCoord(q.lat), lng: roundCoord(q.lng) };
  return fallback;
}

async function blockedIds(deps: Deps, userId: string | undefined) {
  if (!userId) return [];
  const rows = await deps.db.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  return rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId));
}

const viewerKey = (req: FastifyRequest) => req.user?.id ?? req.deviceId ?? req.ip;

export default async function listingRoutes(app: FastifyInstance, deps: Deps) {
  const appCheck = makeAppCheckGuard(deps);
  const searchLimit = async (req: FastifyRequest) => {
    await enforceLimit(deps, 'search', req.user?.id ?? req.deviceId ?? req.ip, deps.env.RATE_LIMIT_SEARCH_PER_MIN, 60);
  };

  // ------------------------------------------------------------ create

  app.post('/listings', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const body = parse(createBody, req.body);
    await enforceLimit(deps, 'listing-create', user.id, 20, 24 * 3600, 'You have added many items today. Please try tomorrow.');

    // New accounts get a smaller allowance for their first day (anti-spam).
    if (Date.now() - user.createdAt.getTime() < DAY_MS) {
      const limits = await getSetting(deps.db, 'limits');
      const made = await deps.db.listing.count({ where: { userId: user.id } });
      if (made >= limits.newAccountListingsFirstDay) throw tooMany('New accounts can add a few items on the first day. Please try again tomorrow.');
    }

    if (!user.cityId) throw badRequest('Choose your city first', 'NO_CITY');
    const city = await deps.db.city.findUnique({ where: { id: user.cityId } });
    if (!city?.isOpen) throw badRequest('Your city is not open for new items yet', 'CITY_NOT_OPEN');
    const area = await deps.db.area.findFirst({ where: { id: body.areaId, cityId: city.id } });
    if (!area) throw badRequest('Choose an area in your city', 'BAD_AREA');
    const category = await deps.db.category.findFirst({ where: { id: body.categoryId, isActive: true } });
    if (!category) throw badRequest('Choose a category', 'BAD_CATEGORY');

    const low = minRent(body.rentDay, body.rentWeek, body.rentMonth);
    if (low === null) throw badRequest('Add rent per day, week or month', 'NO_RENT');

    let whatsappPhone: string | null = null;
    if (body.whatsappPhone) {
      whatsappPhone = normalisePhone(body.whatsappPhone);
      if (!whatsappPhone) throw badRequest('Enter a valid 10-digit WhatsApp number', 'BAD_PHONE');
    }

    const title = cleanListingText(body.title);
    const description = cleanListingText(body.description);
    if (title.text.length < 8) throw badRequest('Title is too short after removing contact details', 'TITLE_SHORT');
    const extra = checkExtra(category, body.extra);

    const imageIds = body.imageIds ?? [];
    if (body.submit && imageIds.length < 1) throw badRequest('Add at least one photo', 'NO_PHOTOS');
    const uploads = await claimUploads(deps, user.id, imageIds, 'listing');
    if (uploads.some((u) => u.status === 'ATTACHED')) throw badRequest('A photo is already used on another item', 'UPLOAD_USED');

    const flags = body.submit
      ? await moderationFlags(deps.db, {
          userId: user.id,
          cityId: city.id,
          categoryId: category.id,
          title: title.text,
          description: description.text,
          minRentPaise: low,
          dhashes: uploads.map((u) => u.dhash!).filter(Boolean),
        })
      : [];
    const decision = body.submit ? await decideStatus(deps, user.id, flags) : { status: 'DRAFT' as ListingStatus, reason: null };

    const listing = await deps.db.$transaction(async (tx) => {
      const created = await tx.listing.create({
        data: {
          shortId: newShortId(),
          userId: user.id, // owner always from the token
          cityId: city.id,
          areaId: area.id,
          categoryId: category.id,
          title: title.text,
          description: description.text,
          rentDayPaise: body.rentDay ?? null,
          rentWeekPaise: body.rentWeek ?? null,
          rentMonthPaise: body.rentMonth ?? null,
          minRentPaise: low,
          depositPaise: body.deposit ?? null,
          condition: body.condition,
          extra,
          whatsappPhone,
          status: decision.status,
          hiddenReason: decision.reason,
          approxLat: roundCoord(area.lat),
          approxLng: roundCoord(area.lng),
          moderationFlags: flags,
          publishedAt: decision.status === 'LIVE' ? new Date() : null,
          images: {
            create: uploads.map((u, i) => ({
              storageKey: u.finalKey!,
              width: u.width ?? 0,
              height: u.height ?? 0,
              sortOrder: i,
              hash: u.hash ?? '',
              dhash: u.dhash ?? '0',
            })),
          },
        },
        include: { ...cardInclude, images: { orderBy: { sortOrder: 'asc' } }, city: true },
      });
      // updateMany with status check: a photo can be attached to one item only.
      if (uploads.length) {
        const res = await tx.upload.updateMany({ where: { id: { in: imageIds }, status: 'READY' }, data: { status: 'ATTACHED' } });
        if (res.count !== uploads.length) throw conflict('A photo is already used on another item', 'UPLOAD_USED');
      }
      if (!user.isLister) await tx.user.update({ where: { id: user.id }, data: { isLister: true } });
      return created;
    });

    return {
      listing: await serializeOwnListing(deps.storage, listing),
      warnings: title.removed || description.removed ? ['CONTACT_REMOVED'] : [],
      message: decision.reason ? DRAFT_MESSAGES[decision.reason] : decision.status === 'REVIEW' ? 'Submitted. We will check it shortly.' : null,
    };
  });

  // ------------------------------------------------------------ edit

  app.patch('/listings/:id', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const body = parse(patchBody, req.body);
    const existing = await loadOwn(deps, user.id, id);

    const data: Prisma.ListingUpdateInput = {};
    let removed = false;
    if (body.title !== undefined) {
      const t = cleanListingText(body.title);
      if (t.text.length < 8) throw badRequest('Title is too short after removing contact details', 'TITLE_SHORT');
      data.title = t.text;
      removed ||= t.removed;
    }
    if (body.description !== undefined) {
      const d = cleanListingText(body.description);
      data.description = d.text;
      removed ||= d.removed;
    }
    if (body.areaId) {
      const area = await deps.db.area.findFirst({ where: { id: body.areaId, cityId: existing.cityId } });
      if (!area) throw badRequest('Choose an area in your city', 'BAD_AREA');
      data.area = { connect: { id: area.id } };
      data.approxLat = roundCoord(area.lat);
      data.approxLng = roundCoord(area.lng);
    }
    let category: Category | null = null;
    if (body.categoryId) {
      category = await deps.db.category.findFirst({ where: { id: body.categoryId, isActive: true } });
      if (!category) throw badRequest('Choose a category', 'BAD_CATEGORY');
      data.category = { connect: { id: category.id } };
    }
    if (body.extra !== undefined) {
      category ??= await deps.db.category.findUniqueOrThrow({ where: { id: existing.categoryId } });
      data.extra = checkExtra(category, body.extra);
    }
    const d = body.rentDay !== undefined ? body.rentDay : existing.rentDayPaise;
    const w = body.rentWeek !== undefined ? body.rentWeek : existing.rentWeekPaise;
    const m = body.rentMonth !== undefined ? body.rentMonth : existing.rentMonthPaise;
    const low = minRent(d, w, m);
    if (low === null) throw badRequest('Add rent per day, week or month', 'NO_RENT');
    Object.assign(data, { rentDayPaise: d, rentWeekPaise: w, rentMonthPaise: m, minRentPaise: low });
    if (body.deposit !== undefined) data.depositPaise = body.deposit;
    if (body.condition) data.condition = body.condition;
    if (body.whatsappPhone !== undefined) {
      if (body.whatsappPhone === null || body.whatsappPhone === '') data.whatsappPhone = null;
      else {
        const p = normalisePhone(body.whatsappPhone);
        if (!p) throw badRequest('Enter a valid 10-digit WhatsApp number', 'BAD_PHONE');
        data.whatsappPhone = p;
      }
    }

    let newUploads: Awaited<ReturnType<typeof claimUploads>> | null = null;
    if (body.imageIds) {
      const current = await deps.db.listingImage.findMany({ where: { listingId: id } });
      const keep = new Set(current.map((c) => c.id));
      // imageIds may mix existing image ids and new upload ids.
      const fresh = body.imageIds.filter((x) => !keep.has(x));
      newUploads = await claimUploads(deps, user.id, fresh, 'listing');
      if (newUploads.some((u) => u.status === 'ATTACHED')) throw badRequest('A photo is already used on another item', 'UPLOAD_USED');
      if (body.imageIds.length === 0 && existing.status !== 'DRAFT') throw badRequest('Add at least one photo', 'NO_PHOTOS');
    }

    // Edits to a public item re-run the automatic checks.
    const visible = ['LIVE', 'REVIEW', 'RENTED_OUT'].includes(existing.status);
    let message: string | null = null;
    if (visible) {
      const flags = await moderationFlags(deps.db, {
        userId: user.id,
        cityId: existing.cityId,
        categoryId: category?.id ?? existing.categoryId,
        title: (data.title as string) ?? existing.title,
        description: (data.description as string) ?? existing.description,
        minRentPaise: low,
        dhashes: newUploads?.map((u) => u.dhash!).filter(Boolean) ?? [],
        listingId: id,
      });
      data.moderationFlags = flags;
      const cap = await listingCapacity(deps.db, user.id);
      if (!cap.hasPlan) {
        // Plan ran out while editing: save the work, park the item.
        data.status = 'DRAFT';
        data.hiddenReason = 'NEEDS_PLAN';
        message = DRAFT_MESSAGES.NEEDS_PLAN!;
      } else if (flags.length && existing.status === 'LIVE') {
        data.status = 'REVIEW';
        message = 'Saved. We will check the changes shortly.';
      }
    }

    const updated = await deps.db.$transaction(async (tx) => {
      if (body.imageIds) {
        await tx.listingImage.deleteMany({ where: { listingId: id, id: { notIn: body.imageIds } } });
        const existingImgs = await tx.listingImage.findMany({ where: { listingId: id } });
        const byId = new Map(existingImgs.map((i) => [i.id, i]));
        const uploadById = new Map((newUploads ?? []).map((u) => [u.id, u]));
        for (const [i, imgId] of body.imageIds.entries()) {
          if (byId.has(imgId)) {
            await tx.listingImage.update({ where: { id: imgId }, data: { sortOrder: i } });
          } else {
            const u = uploadById.get(imgId)!;
            await tx.listingImage.create({
              data: { listingId: id, storageKey: u.finalKey!, width: u.width ?? 0, height: u.height ?? 0, sortOrder: i, hash: u.hash ?? '', dhash: u.dhash ?? '0' },
            });
          }
        }
        if (newUploads?.length) {
          const res = await tx.upload.updateMany({ where: { id: { in: newUploads.map((u) => u.id) }, status: 'READY' }, data: { status: 'ATTACHED' } });
          if (res.count !== newUploads.length) throw conflict('A photo is already used on another item', 'UPLOAD_USED');
        }
      }
      return tx.listing.update({
        where: { id },
        data,
        include: { ...cardInclude, images: { orderBy: { sortOrder: 'asc' } }, city: true },
      });
    });
    return { listing: await serializeOwnListing(deps.storage, updated), warnings: removed ? ['CONTACT_REMOVED'] : [], message };
  });

  app.delete('/listings/:id', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    await loadOwn(deps, user.id, id);
    await deps.db.listing.update({ where: { id }, data: { status: 'REMOVED', deletedAt: new Date(), featuredUntil: null } });
    return { ok: true };
  });

  app.post('/listings/:id/status', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const { action } = parse(statusBody, req.body);
    const l = await loadOwn(deps, user.id, id);
    const city = await deps.db.city.findUniqueOrThrow({ where: { id: l.cityId } });

    let next: Prisma.ListingUncheckedUpdateInput = {};
    let message: string | null = null;
    const goLive = async () => {
      if (!city.isOpen) {
        return { status: 'DRAFT' as ListingStatus, hiddenReason: 'CITY_CLOSED', msg: DRAFT_MESSAGES.CITY_CLOSED! };
      }
      const imgCount = await deps.db.listingImage.count({ where: { listingId: id } });
      if (imgCount < 1) throw badRequest('Add at least one photo', 'NO_PHOTOS');
      const decision = await decideStatus(deps, user.id, l.moderationFlags, id);
      return { status: decision.status, hiddenReason: decision.reason, msg: decision.reason ? DRAFT_MESSAGES[decision.reason]! : null };
    };

    if (action === 'rented_out') {
      if (l.status !== 'LIVE') throw badRequest('Only live items can be marked rented out', 'BAD_STATE');
      next = { status: 'RENTED_OUT' };
    } else if (action === 'pause') {
      if (!['LIVE', 'RENTED_OUT', 'REVIEW'].includes(l.status)) throw badRequest('This item is not live', 'BAD_STATE');
      next = { status: 'HIDDEN', hiddenReason: 'PAUSED' };
    } else if (action === 'available') {
      if (l.status === 'RENTED_OUT') next = { status: 'LIVE' };
      else if (l.status === 'HIDDEN' && l.hiddenReason === 'PAUSED') {
        const r = await goLive();
        next = { status: r.status, hiddenReason: r.hiddenReason };
        message = r.msg;
      } else throw badRequest('This item cannot be made available', 'BAD_STATE');
    } else {
      // submit: drafts, and items parked because the plan ended
      const parked = l.status === 'HIDDEN' && ['PLAN_ENDED', 'OVER_LIMIT', 'NEEDS_PLAN'].includes(l.hiddenReason ?? '');
      if (l.status !== 'DRAFT' && !parked) throw badRequest('Only drafts can be submitted', 'BAD_STATE');
      const r = await goLive();
      next = { status: r.status, hiddenReason: r.hiddenReason };
      message = r.msg;
    }
    if (next.status === 'LIVE' && !l.publishedAt) next.publishedAt = new Date();
    if (next.status === 'LIVE') next.hiddenReason = null;

    const updated = await deps.db.listing.update({
      where: { id },
      data: next,
      include: { ...cardInclude, images: { orderBy: { sortOrder: 'asc' } }, city: true },
    });
    return { listing: await serializeOwnListing(deps.storage, updated), message };
  });

  app.get('/listings/mine', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const q = parse(z.object({ cursor: z.string().max(200).optional(), limit: z.coerce.number().int().optional() }).strict(), req.query);
    const take = clampLimit(q.limit);
    const offset = decodeCursor(q.cursor);
    const rows = await deps.db.listing.findMany({
      where: { userId: user.id, status: { not: 'REMOVED' } },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: take + 1,
      include: { ...cardInclude, images: { orderBy: { sortOrder: 'asc' } }, city: true },
    });
    const items = await Promise.all(rows.slice(0, take).map((l) => serializeOwnListing(deps.storage, l)));
    return { items, nextCursor: rows.length > take ? encodeCursor(offset + take) : null };
  });

  // ------------------------------------------------------------ public read

  app.get('/listings', { preHandler: [searchLimit, appCheck] }, async (req) => {
    const q = parse(searchQuery, req.query);
    const take = clampLimit(q.limit);
    const offset = decodeCursor(q.cursor);
    const city = await deps.db.city.findUnique({ where: { id: q.city } });
    if (!city || !city.isOpen) return { items: [], total: 0, nextCursor: null };

    let fallback: Origin = { lat: city.lat, lng: city.lng };
    if (q.area) {
      const area = await deps.db.area.findFirst({ where: { id: q.area, cityId: city.id } });
      if (area) fallback = { lat: area.lat, lng: area.lng };
    }
    const origin = originFrom(q, fallback)!;
    const blocked = await blockedIds(deps, req.user?.id);

    const priceCol =
      q.period === 'day'
        ? Prisma.sql`l."rentDayPaise"`
        : q.period === 'week'
          ? Prisma.sql`l."rentWeekPaise"`
          : q.period === 'month'
            ? Prisma.sql`l."rentMonthPaise"`
            : Prisma.sql`l."minRentPaise"`;

    // Everything below is built from Prisma.sql fragments: values are always
    // bound parameters, never pasted into the SQL text.
    const where: Prisma.Sql[] = [
      Prisma.sql`l.status = 'LIVE'`,
      Prisma.sql`c."isOpen" = true`,
      Prisma.sql`l."cityId" = ${city.id}::uuid`,
      Prisma.sql`u.status = 'ACTIVE'`,
    ];
    if (q.category) where.push(Prisma.sql`l."categoryId" = ${q.category}::uuid`);
    if (q.area) where.push(Prisma.sql`l."areaId" = ${q.area}::uuid`);
    if (q.period) where.push(Prisma.sql`${priceCol} IS NOT NULL`);
    if (q.min !== undefined) where.push(Prisma.sql`${priceCol} >= ${q.min * 100}`);
    if (q.max !== undefined) where.push(Prisma.sql`${priceCol} <= ${q.max * 100}`);
    if (q.verified === 'true') where.push(Prisma.sql`u."idVerified" = true`);
    if (blocked.length) where.push(Prisma.sql`l."userId" NOT IN (${Prisma.join(blocked.map((b) => Prisma.sql`${b}::uuid`))})`);
    const text = q.q?.replace(/\s+/g, ' ').trim();
    if (text) {
      const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      where.push(
        Prisma.sql`(to_tsvector('simple', coalesce(l.title,'') || ' ' || coalesce(l.description,'')) @@ plainto_tsquery('simple', ${text}) OR l.title ILIKE ${like})`,
      );
    }
    const whereSql = Prisma.join(where, ' AND ');
    const dist = Prisma.sql`(6371 * acos(least(1, cos(radians(${origin.lat})) * cos(radians(l."approxLat")) * cos(radians(l."approxLng") - radians(${origin.lng})) + sin(radians(${origin.lat})) * sin(radians(l."approxLat")))))`;
    const order =
      q.sort === 'nearest'
        ? Prisma.sql`${dist} ASC, l."publishedAt" DESC`
        : q.sort === 'price'
          ? Prisma.sql`${priceCol} ASC, l."publishedAt" DESC`
          : Prisma.sql`l."publishedAt" DESC NULLS LAST, l.id`;

    const from = Prisma.sql`FROM "Listing" l JOIN "City" c ON c.id = l."cityId" JOIN "User" u ON u.id = l."userId"`;
    const [ids, countRows] = await Promise.all([
      deps.db.$queryRaw<Array<{ id: string }>>`SELECT l.id ${from} WHERE ${whereSql} ORDER BY ${order} LIMIT ${take + 1} OFFSET ${offset}`,
      deps.db.$queryRaw<Array<{ n: bigint }>>`SELECT count(*)::bigint AS n ${from} WHERE ${whereSql}`,
    ]);
    const total = Number(countRows[0]?.n ?? 0);
    const pageIds = ids.slice(0, take).map((r) => r.id);
    const rows = await deps.db.listing.findMany({ where: { id: { in: pageIds } }, include: cardInclude });
    const byId = new Map(rows.map((r) => [r.id, r]));
    const saved = req.user
      ? new Set((await deps.db.favorite.findMany({ where: { userId: req.user.id, listingId: { in: pageIds } } })).map((f) => f.listingId))
      : new Set<string>();

    const showDistance = q.sort === 'nearest' || (q.lat !== undefined && q.lng !== undefined) || !!q.area;
    const items = await Promise.all(
      pageIds
        .map((id) => byId.get(id))
        .filter((l): l is NonNullable<typeof l> => !!l)
        .map((l) => serializeCard(deps.storage, l, { origin: showDistance ? origin : null, saved: saved.has(l.id) })),
    );

    // Insights log (no user id, ever). First page only so paging does not inflate numbers.
    if (offset === 0 && (text || q.category)) {
      await deps.db.searchLog
        .create({ data: { cityId: city.id, query: text?.toLowerCase() ?? null, categoryId: q.category ?? null, resultCount: total } })
        .catch(() => undefined);
    }
    return { items, total, nextCursor: ids.length > take ? encodeCursor(offset + take) : null };
  });

  app.get('/listings/featured', { preHandler: searchLimit }, async (req) => {
    const q = parse(z.object({ city: z.uuid() }).strict(), req.query);
    const blocked = await blockedIds(deps, req.user?.id);
    const { sponsoredPerCity } = await getSetting(deps.db, 'limits');
    const rows = await deps.db.listing.findMany({
      where: {
        cityId: q.city,
        status: 'LIVE',
        city: { isOpen: true },
        featuredUntil: { gt: new Date() },
        userId: blocked.length ? { notIn: blocked } : undefined,
      },
      orderBy: { featuredUntil: 'asc' },
      take: sponsoredPerCity,
      include: cardInclude,
    });
    return { items: await Promise.all(rows.map((l) => serializeCard(deps.storage, l))) };
  });

  // App Links land on /i/<shortId>; the app swaps it for the listing id.
  app.get('/listings/by-short/:shortId', { preHandler: searchLimit }, async (req) => {
    const { shortId } = parse(z.object({ shortId: z.string().regex(/^[A-Z0-9]{10}$/) }).strict(), req.params);
    const l = await deps.db.listing.findUnique({ where: { shortId }, select: { id: true, status: true, city: { select: { isOpen: true } } } });
    if (!l || l.status !== 'LIVE' || !l.city.isOpen) throw notFound('This item is no longer available', 'LISTING_GONE');
    return { id: l.id };
  });

  app.get('/listings/:id', { preHandler: searchLimit }, async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const q = parse(z.object({ lat: z.coerce.number().optional(), lng: z.coerce.number().optional() }).strict(), req.query);
    const l = await deps.db.listing.findUnique({
      where: { id },
      include: {
        ...cardInclude,
        images: { orderBy: { sortOrder: 'asc' } },
        city: true,
        user: { select: { id: true, idVerified: true, name: true, createdAt: true, status: true, shop: { select: { shortId: true, shopName: true } } } },
      },
    });
    const isOwner = !!req.user && l?.userId === req.user.id;
    const visible = l && (isOwner || (['LIVE', 'RENTED_OUT'].includes(l.status) && l.city.isOpen && l.user.status === 'ACTIVE'));
    if (!l || !visible) throw notFound('This item is no longer available', 'LISTING_GONE');
    const blocked = await blockedIds(deps, req.user?.id);
    if (blocked.includes(l.userId)) throw notFound('This item is no longer available', 'LISTING_GONE');

    // One view per viewer per day.
    if (!isOwner) {
      const fresh = await deps.redis.set(`view:${id}:${viewerKey(req)}:${istDay()}`, '1', 'EX', 26 * 3600, 'NX');
      if (fresh === 'OK') await deps.db.listing.update({ where: { id }, data: { viewCount: { increment: 1 } } });
    }
    const saved = req.user ? !!(await deps.db.favorite.findUnique({ where: { userId_listingId: { userId: req.user.id, listingId: id } } })) : false;
    const origin = q.lat !== undefined && q.lng !== undefined ? { lat: roundCoord(q.lat), lng: roundCoord(q.lng) } : null;
    return { ...(await serializeDetail(deps.storage, l, { origin, saved, isOwner })), status: l.status === 'RENTED_OUT' ? 'RENTED_OUT' : 'LIVE' };
  });

  // ------------------------------------------------------------ WhatsApp contact (A-11)

  app.post('/listings/:id/contact', { preHandler: [requireUser, appCheck] }, async (req) => {
    const user = currentUser(req);
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    await enforceLimit(deps, 'contact-burst', user.id, 20, 60, 'Please slow down a little.');

    const l = await deps.db.listing.findUnique({ where: { id }, include: { city: true, user: { select: { id: true, phone: true, status: true } } } });
    if (!l || l.status !== 'LIVE' || !l.city.isOpen || l.user.status !== 'ACTIVE') throw notFound('This item is no longer available', 'LISTING_GONE');
    if (l.userId === user.id) throw badRequest('This is your own item', 'OWN_LISTING');
    const block = await deps.db.block.findFirst({
      where: { OR: [{ blockerId: l.userId, blockedId: user.id }, { blockerId: user.id, blockedId: l.userId }] },
    });
    if (block) throw forbidden('You cannot contact this owner', 'BLOCKED');

    const settings = await getSettings(deps.db);
    const day = istDay();
    const already = await deps.db.contactEvent.findUnique({ where: { seekerId_ownerId_day: { seekerId: user.id, ownerId: l.userId, day } } });
    if (!already) {
      const owners = await deps.db.contactEvent.count({ where: { seekerId: user.id, day } });
      if (owners >= settings.limits.contactsPerDay) {
        req.log.warn({ userId: user.id }, 'contact daily limit hit');
        await deps.redis.incr(`abuse:contact-limit:${user.id}:${day}`);
        throw tooMany('You have contacted many owners today. Try again tomorrow.', 'CONTACT_LIMIT');
      }
      try {
        await deps.db.$transaction([
          deps.db.contactEvent.create({ data: { seekerId: user.id, ownerId: l.userId, listingId: l.id, day } }),
          deps.db.listing.update({ where: { id }, data: { waClickCount: { increment: 1 } } }),
        ]);
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
      }
    }

    const phone = (l.whatsappPhone ?? l.user.phone).replace('+', '');
    const link = `${deps.env.PUBLIC_WEB_URL}/i/${l.shortId}`;
    const text = `Hi, I saw your "${l.title}" on RentNook (${link}). Is it available?`;
    return { whatsappUrl: `https://wa.me/${phone}?text=${encodeURIComponent(text)}` };
  });
}
