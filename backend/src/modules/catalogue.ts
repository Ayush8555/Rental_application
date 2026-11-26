import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { currentUser, requireUser } from '../plugins/auth.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { badRequest, notFound } from '../lib/errors.ts';
import { parse } from '../lib/validate.ts';
import { Prisma } from '../services/db.ts';
import { getSettings } from '../services/settings.ts';
import { serializeCategory, serializeCity } from './serializers.ts';

export default async function catalogueRoutes(app: FastifyInstance, deps: Deps) {
  app.get('/cities', async (_req, reply) => {
    const cities = await deps.db.city.findMany({ orderBy: [{ isOpen: 'desc' }, { name: 'asc' }], take: 500 });
    reply.header('Cache-Control', 'public, max-age=60');
    return { items: cities.map(serializeCity) };
  });

  app.get('/cities/:id/areas', async (req, reply) => {
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const areas = await deps.db.area.findMany({ where: { cityId: id }, orderBy: { name: 'asc' }, take: 500 });
    reply.header('Cache-Control', 'public, max-age=60');
    return { items: areas.map((a) => ({ id: a.id, name: a.name })) };
  });

  app.post('/cities/:id/waitlist', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'waitlist', user.id, 10, 3600);
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const city = await deps.db.city.findUnique({ where: { id } });
    if (!city) throw notFound('City not found');
    if (city.isOpen) throw badRequest('This city is already open', 'CITY_OPEN');
    try {
      await deps.db.cityWaitlist.create({ data: { cityId: id, userId: user.id } });
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) throw err;
    }
    return { ok: true, message: `We will let you know when ${city.name} opens.` };
  });

  app.get('/categories', async (_req, reply) => {
    const items = await deps.db.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
    reply.header('Cache-Control', 'public, max-age=60');
    return { items: items.map(serializeCategory) };
  });

  app.get('/settings/public', async (_req, reply) => {
    const s = await getSettings(deps.db);
    reply.header('Cache-Control', 'public, max-age=60');
    return {
      minAppVersion: s.app.minVersion,
      latestAppVersion: s.app.latestVersion,
      support: s.support,
      grievance: s.grievance,
      company: { legalName: s.company.legalName },
      legal: { ...s.legal, privacyUrl: `${deps.env.PUBLIC_WEB_URL}/privacy`, termsUrl: `${deps.env.PUBLIC_WEB_URL}/terms`, deleteUrl: `${deps.env.PUBLIC_WEB_URL}/delete-account` },
      help: s.help,
      boostOptions: s.boostOptions,
      limits: { contactsPerDay: s.limits.contactsPerDay, requestsPerDay: s.limits.requestsPerDay },
      playStoreUrl: deps.env.PLAY_STORE_URL,
    };
  });
}
