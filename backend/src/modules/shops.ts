import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { currentUser, requireUser } from '../plugins/auth.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { badRequest, forbidden, notFound } from '../lib/errors.ts';
import { newShortId } from '../lib/ids.ts';
import { cleanListingText } from '../lib/text-filter.ts';
import { parse } from '../lib/validate.ts';
import { claimUploads } from './uploads.ts';
import { activeSubscription } from './subscription-state.ts';
import { cardInclude, imageUrl, serializeCard } from './serializers.ts';

const shopBody = z
  .object({
    shopName: z.string().trim().min(3).max(50),
    areaId: z.uuid(),
    timings: z.string().trim().min(3).max(80),
    about: z.string().trim().max(500),
    logoUploadId: z.uuid().nullable().optional(),
  })
  .strict();

export async function shopIsActive(deps: Deps, userId: string) {
  const sub = await activeSubscription(deps.db, userId);
  return !!sub?.shopPage;
}

export default async function shopRoutes(app: FastifyInstance, deps: Deps) {
  app.get('/shops/me', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const shop = await deps.db.shopProfile.findUnique({ where: { userId: user.id }, include: { area: true } });
    return {
      allowed: await shopIsActive(deps, user.id),
      shop: shop
        ? {
            id: shop.shortId,
            shopName: shop.shopName,
            area: { id: shop.area.id, name: shop.area.name },
            timings: shop.timings,
            about: shop.about,
            logo: shop.logoKey ? await imageUrl(deps.storage, shop.logoKey) : null,
            shareLink: `${deps.env.PUBLIC_WEB_URL}/s/${shop.shortId}`,
          }
        : null,
    };
  });

  app.put('/shops/me', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'shop-edit', user.id, 30, 3600);
    if (!(await shopIsActive(deps, user.id))) throw forbidden('Shop page comes with the Business plan', 'NEEDS_BUSINESS_PLAN');
    const body = parse(shopBody, req.body);
    if (!user.cityId) throw badRequest('Choose your city first', 'NO_CITY');
    const area = await deps.db.area.findFirst({ where: { id: body.areaId, cityId: user.cityId } });
    if (!area) throw badRequest('Choose an area in your city', 'BAD_AREA');

    let logoKey: string | null | undefined;
    if (body.logoUploadId) {
      const [u] = await claimUploads(deps, user.id, [body.logoUploadId], 'logo');
      logoKey = u!.finalKey!;
      await deps.db.upload.update({ where: { id: u!.id }, data: { status: 'ATTACHED' } });
    } else if (body.logoUploadId === null) {
      logoKey = null;
    }

    const data = {
      shopName: cleanListingText(body.shopName).text,
      areaId: area.id,
      timings: cleanListingText(body.timings).text,
      about: cleanListingText(body.about).text,
      ...(logoKey !== undefined ? { logoKey } : {}),
    };
    const shop = await deps.db.shopProfile.upsert({
      where: { userId: user.id },
      create: { ...data, userId: user.id, shortId: newShortId() },
      update: data,
    });
    return { id: shop.shortId, shareLink: `${deps.env.PUBLIC_WEB_URL}/s/${shop.shortId}` };
  });

  // Public. Visible only while the owner's Business plan is active.
  app.get('/shops/:id', async (req) => {
    const { id } = parse(z.object({ id: z.string().regex(/^[A-Z0-9]{10}$/) }).strict(), req.params);
    const shop = await deps.db.shopProfile.findUnique({ where: { shortId: id }, include: { area: true, user: { select: { id: true, status: true, idVerified: true, createdAt: true } } } });
    if (!shop || shop.user.status !== 'ACTIVE' || !(await shopIsActive(deps, shop.userId))) throw notFound('Shop not found');
    const items = await deps.db.listing.findMany({
      where: { userId: shop.userId, status: 'LIVE', city: { isOpen: true } },
      orderBy: { publishedAt: 'desc' },
      take: 50,
      include: cardInclude,
    });
    return {
      id: shop.shortId,
      shopName: shop.shopName,
      area: { id: shop.area.id, name: shop.area.name },
      timings: shop.timings,
      about: shop.about,
      verified: shop.user.idVerified,
      memberSince: shop.user.createdAt.toISOString().slice(0, 7),
      logo: shop.logoKey ? await imageUrl(deps.storage, shop.logoKey) : null,
      shareLink: `${deps.env.PUBLIC_WEB_URL}/s/${shop.shortId}`,
      items: await Promise.all(items.map((l) => serializeCard(deps.storage, l))),
    };
  });
}
