import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { currentUser, requireUser } from '../plugins/auth.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { badRequest, conflict, unauthorized } from '../lib/errors.ts';
import { addDays, daysLeft } from '../lib/time.ts';
import { parse } from '../lib/validate.ts';
import { getSetting } from '../services/settings.ts';
import { consentRequired, revokeAllSessions } from './auth.ts';
import { serializeMe } from './serializers.ts';
import { activeSubscription } from './subscription-state.ts';

// Letters (any script, so Hindi names work), spaces, dots, apostrophes.
const NAME = /^[\p{L}\p{M}][\p{L}\p{M} .']{1,39}$/u;

const patchMe = z
  .object({
    name: z.string().trim().min(2).max(40).regex(NAME, 'Use letters, spaces and dots only').optional(),
    cityId: z.uuid().optional(),
    language: z.enum(['en', 'hi']).optional(),
  })
  .strict();

const deleteBody = z
  .object({
    idToken: z.string().min(10).max(4096), // fresh OTP proves it is really the owner
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

export const DELETION_DAYS = 7;

export async function startDeletion(deps: Deps, userId: string, source: 'app' | 'web', reason?: string) {
  const existing = await deps.db.deletionRequest.findUnique({ where: { userId } });
  if (existing) return existing;
  const req = await deps.db.$transaction(async (tx) => {
    const created = await tx.deletionRequest.create({
      data: { userId, source, reason: reason ?? null, dueAt: addDays(new Date(), DELETION_DAYS) },
    });
    await tx.user.update({ where: { id: userId }, data: { status: 'DELETED' } });
    await tx.listing.updateMany({
      where: { userId, status: { in: ['DRAFT', 'REVIEW', 'LIVE', 'RENTED_OUT', 'HIDDEN'] } },
      data: { status: 'HIDDEN', hiddenReason: 'DELETION' },
    });
    await revokeAllSessions(tx, userId);
    await tx.deviceToken.deleteMany({ where: { userId } });
    return created;
  });
  // The deletion job itself runs daily and picks this up (jobs/account-deletion.ts).
  return req;
}

export default async function meRoutes(app: FastifyInstance, deps: Deps) {
  app.get('/me', { preHandler: requireUser }, async (req) => {
    const user = await deps.db.user.findUniqueOrThrow({ where: { id: currentUser(req).id }, include: { city: true } });
    const sub = await activeSubscription(deps.db, user.id);
    return {
      ...serializeMe(user, await consentRequired(deps, user.id)),
      plan: sub
        ? { name: sub.planName, nameHi: sub.planNameHi, type: sub.planType, endsAt: sub.endsAt?.toISOString() ?? null, daysLeft: daysLeft(sub.endsAt) }
        : null,
    };
  });

  app.patch('/me', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const body = parse(patchMe, req.body);
    if (body.cityId) {
      const city = await deps.db.city.findUnique({ where: { id: body.cityId } });
      if (!city) throw badRequest('Choose a city from the list', 'BAD_CITY');
      if (!city.isOpen) throw badRequest('This city is not open yet', 'CITY_NOT_OPEN');
    }
    const updated = await deps.db.user.update({
      where: { id: user.id },
      // Only these three fields. role/status/isLister never come from the client.
      data: { name: body.name, cityId: body.cityId, language: body.language },
      include: { city: true },
    });
    return serializeMe(updated, await consentRequired(deps, user.id));
  });

  app.get('/me/consents', { preHandler: requireUser }, async (req) => {
    const rows = await deps.db.consentLog.findMany({ where: { userId: currentUser(req).id }, orderBy: { acceptedAt: 'desc' }, take: 20 });
    return { items: rows.map((r) => ({ version: r.noticeVersion, acceptedAt: r.acceptedAt, withdrawnAt: r.withdrawnAt })) };
  });

  app.post('/me/consents', { preHandler: requireUser }, async (req) => {
    const { version } = parse(z.object({ version: z.string().max(20) }).strict(), req.body);
    const legal = await getSetting(deps.db, 'legal');
    if (version !== legal.privacyVersion) throw badRequest('Please accept the latest version', 'OLD_VERSION');
    const userId = currentUser(req).id;
    const has = await deps.db.consentLog.findFirst({ where: { userId, noticeVersion: version, withdrawnAt: null } });
    if (!has) await deps.db.consentLog.create({ data: { userId, noticeVersion: version, ip: req.ip } });
    return { ok: true };
  });

  app.post('/me/delete-request', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'delete-req', user.id, 5, 3600);
    const body = parse(deleteBody, req.body);
    const verified = await deps.phoneAuth.verifyIdToken(body.idToken);
    // The fresh OTP must belong to this same account, not just any account.
    if (!verified || verified.phone !== user.phone) throw unauthorized('The code did not match this account', 'REAUTH_FAILED');
    const exists = await deps.db.deletionRequest.findUnique({ where: { userId: user.id } });
    if (exists) throw conflict('Deletion has already been requested', 'ALREADY_REQUESTED');
    const request = await startDeletion(deps, user.id, 'app', body.reason);
    return { ok: true, dueAt: request.dueAt.toISOString() };
  });
}
