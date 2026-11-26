import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { ACCESS_TTL_SEC, currentUser, makeAppCheckGuard, requireUser, signAccessToken } from '../plugins/auth.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { hmac } from '../lib/crypto.ts';
import { badRequest, forbidden, unauthorized } from '../lib/errors.ts';
import { newReferralCode, randomToken } from '../lib/ids.ts';
import { isIndianMobile } from '../lib/phone.ts';
import { DAY_MS } from '../lib/time.ts';
import { parse } from '../lib/validate.ts';
import { Prisma, type Db } from '../services/db.ts';
import { getSetting } from '../services/settings.ts';
import { serializeMe } from './serializers.ts';

const REFRESH_TTL_MS = 60 * DAY_MS;

const loginBody = z
  .object({
    idToken: z.string().min(10).max(4096),
    consentVersion: z.string().max(20).optional(),
    referralCode: z.string().regex(/^[A-Z0-9]{5,10}$/).optional(),
  })
  .strict();

const refreshBody = z.object({ refreshToken: z.string().min(20).max(200) }).strict();

export const hashRefresh = (deps: Deps, token: string) => hmac(deps.env.REFRESH_TOKEN_PEPPER, token);

async function createUser(db: Db, phone: string) {
  // Referral codes are short, so retry on the rare collision.
  for (let i = 0; i < 5; i++) {
    try {
      return await db.user.create({ data: { phone, referralCode: newReferralCode() } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await db.user.findUnique({ where: { phone } });
        if (existing) return existing; // two logins raced; fine
        continue;
      }
      throw err;
    }
  }
  throw new Error('could not allocate referral code');
}

export async function issueSession(deps: Deps, userId: string, deviceId: string | null, appVersion: string | null, familyId: string = randomUUID()) {
  const refreshToken = randomToken(32);
  const session = await deps.db.session.create({
    data: {
      userId,
      familyId,
      refreshTokenHash: hashRefresh(deps, refreshToken),
      deviceId,
      appVersion,
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
    },
  });
  const accessToken = await signAccessToken(deps, userId, session.id);
  return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SEC, sessionId: session.id };
}

export async function revokeAllSessions(db: Db | Prisma.TransactionClient, userId: string) {
  await db.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export default async function authRoutes(app: FastifyInstance, deps: Deps) {
  const appCheck = makeAppCheckGuard(deps);

  app.post('/auth/firebase', { preHandler: appCheck }, async (req) => {
    await enforceLimit(deps, 'auth-ip', req.ip, deps.env.RATE_LIMIT_AUTH_IP_PER_MIN, 60);
    await enforceLimit(deps, 'auth-dev', req.deviceId, deps.env.RATE_LIMIT_AUTH_DEVICE_PER_MIN, 60);
    const body = parse(loginBody, req.body);

    const verified = await deps.phoneAuth.verifyIdToken(body.idToken);
    if (!verified) throw unauthorized('We could not verify the code. Please try again.', 'BAD_ID_TOKEN');
    if (!isIndianMobile(verified.phone)) {
      throw badRequest('Only Indian mobile numbers (+91) can sign in right now', 'PHONE_NOT_ALLOWED');
    }

    let user = await deps.db.user.findUnique({ where: { phone: verified.phone }, include: { deletion: true } });
    if (user?.status === 'BLOCKED') throw forbidden('This account has been blocked. Contact support if you think this is a mistake.', 'ACCOUNT_BLOCKED');
    if (user?.status === 'DELETED') {
      const due = user.deletion?.dueAt;
      throw forbidden(
        `This account is being deleted${due ? ` (completes by ${due.toISOString().slice(0, 10)})` : ''}.`,
        'ACCOUNT_DELETION_PENDING',
      );
    }
    const isNew = !user;
    if (!user) user = { ...(await createUser(deps.db, verified.phone)), deletion: null };

    const legal = await getSetting(deps.db, 'legal');
    if (body.consentVersion && body.consentVersion === legal.privacyVersion) {
      const has = await deps.db.consentLog.findFirst({
        where: { userId: user.id, noticeVersion: body.consentVersion, withdrawnAt: null },
      });
      if (!has) await deps.db.consentLog.create({ data: { userId: user.id, noticeVersion: body.consentVersion, ip: req.ip } });
    }

    if (isNew && body.referralCode) {
      // Best effort here; the real anti-abuse checks run in referral.apply.
      const { applyReferral } = await import('./referral.ts');
      await applyReferral(deps, user.id, body.referralCode, req.deviceId).catch(() => undefined);
    }

    await deps.db.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    const tokens = await issueSession(deps, user.id, req.deviceId, req.appVersion);
    const fresh = await deps.db.user.findUniqueOrThrow({ where: { id: user.id }, include: { city: true } });
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      needsProfile: !fresh.name || !fresh.cityId,
      user: serializeMe(fresh, await consentRequired(deps, fresh.id)),
    };
  });

  app.post('/auth/refresh', async (req) => {
    await enforceLimit(deps, 'refresh-ip', req.ip, 30, 60);
    const { refreshToken } = parse(refreshBody, req.body);
    const hash = hashRefresh(deps, refreshToken);
    const session = await deps.db.session.findUnique({ where: { refreshTokenHash: hash }, include: { user: true } });
    if (!session) throw unauthorized('Please sign in again', 'SESSION_EXPIRED');

    // A refresh token that was already rotated is being replayed: somebody
    // has a copy. Kill every session of this user.
    if (session.replacedById || session.revokedAt) {
      if (session.replacedById) {
        await revokeAllSessions(deps.db, session.userId);
        req.log.warn({ userId: session.userId }, 'refresh token reuse detected, all sessions revoked');
      }
      throw unauthorized('Please sign in again', 'SESSION_EXPIRED');
    }
    if (session.expiresAt < new Date()) throw unauthorized('Please sign in again', 'SESSION_EXPIRED');
    if (session.user.status !== 'ACTIVE') throw unauthorized('Please sign in again', 'SESSION_EXPIRED');

    const tokens = await issueSession(deps, session.userId, req.deviceId ?? session.deviceId, req.appVersion, session.familyId);
    // Only one of two parallel refreshes may win.
    const won = await deps.db.session.updateMany({
      where: { id: session.id, replacedById: null, revokedAt: null },
      data: { replacedById: tokens.sessionId, lastUsedAt: new Date() },
    });
    if (won.count !== 1) {
      await deps.db.session.update({ where: { id: tokens.sessionId }, data: { revokedAt: new Date() } });
      throw unauthorized('Please sign in again', 'SESSION_EXPIRED');
    }
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, expiresIn: tokens.expiresIn };
  });

  app.post('/auth/logout', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const body = parse(z.object({ fcmToken: z.string().max(4096).optional() }).strict(), req.body);
    const session = await deps.db.session.findUnique({ where: { id: req.sessionId! } });
    if (session) {
      await deps.db.session.updateMany({ where: { familyId: session.familyId, revokedAt: null }, data: { revokedAt: new Date() } });
    }
    if (body.fcmToken) await deps.db.deviceToken.deleteMany({ where: { userId: user.id, fcmToken: body.fcmToken } });
    return { ok: true };
  });
}

export async function consentRequired(deps: Deps, userId: string) {
  const legal = await getSetting(deps.db, 'legal');
  const latest = await deps.db.consentLog.findFirst({
    where: { userId, noticeVersion: legal.privacyVersion, withdrawnAt: null },
  });
  return !latest;
}
