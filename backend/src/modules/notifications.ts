import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { currentUser, requireUser } from '../plugins/auth.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { clampLimit, decodeCursor, encodeCursor } from '../lib/cursor.ts';
import { parse } from '../lib/validate.ts';

export default async function notificationRoutes(app: FastifyInstance, deps: Deps) {
  app.get('/notifications', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const q = parse(z.object({ cursor: z.string().max(200).optional(), limit: z.coerce.number().int().optional() }).strict(), req.query);
    const take = clampLimit(q.limit);
    const offset = decodeCursor(q.cursor);
    const [rows, unread] = await Promise.all([
      deps.db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, skip: offset, take: take + 1 }),
      deps.db.notification.count({ where: { userId: user.id, readAt: null } }),
    ]);
    return {
      unread,
      items: rows.slice(0, take).map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, data: n.data, read: !!n.readAt, createdAt: n.createdAt })),
      nextCursor: rows.length > take ? encodeCursor(offset + take) : null,
    };
  });

  app.post('/notifications/read', { preHandler: requireUser }, async (req) => {
    const body = parse(z.object({ ids: z.array(z.uuid()).max(50).optional(), all: z.boolean().optional() }).strict(), req.body);
    const userId = currentUser(req).id;
    await deps.db.notification.updateMany({
      where: { userId, readAt: null, ...(body.all ? {} : { id: { in: body.ids ?? [] } }) },
      data: { readAt: new Date() },
    });
    return { ok: true };
  });

  app.post('/devices', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'devices', user.id, 20, 3600);
    const body = parse(z.object({ fcmToken: z.string().min(20).max(4096), platform: z.enum(['android', 'ios']) }).strict(), req.body);
    // A token belongs to one phone; if someone else signs in on it, it moves.
    await deps.db.deviceToken.upsert({
      where: { fcmToken: body.fcmToken },
      create: { userId: user.id, fcmToken: body.fcmToken, platform: body.platform },
      update: { userId: user.id, platform: body.platform },
    });
    const count = await deps.db.deviceToken.count({ where: { userId: user.id } });
    if (count > 5) {
      const old = await deps.db.deviceToken.findMany({ where: { userId: user.id }, orderBy: { updatedAt: 'asc' }, take: count - 5 });
      await deps.db.deviceToken.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
    }
    return { ok: true };
  });

  app.delete('/devices/:token', { preHandler: requireUser }, async (req) => {
    const { token } = parse(z.object({ token: z.string().min(20).max(4096) }).strict(), req.params);
    await deps.db.deviceToken.deleteMany({ where: { userId: currentUser(req).id, fcmToken: token } });
    return { ok: true };
  });
}
