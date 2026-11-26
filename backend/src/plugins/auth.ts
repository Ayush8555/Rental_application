import { jwtVerify, SignJWT } from 'jose';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { Deps } from '../deps.ts';
import { forbidden, unauthorized } from '../lib/errors.ts';
import type { User } from '../services/db.ts';

const ALG = 'HS256';
export const ACCESS_TTL_SEC = 15 * 60;

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
    sessionId: string | null;
    deviceId: string | null;
    appVersion: string | null;
  }
}

const DEVICE_ID = /^[A-Za-z0-9_-]{8,128}$/;
const APP_VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}(\+\d{1,6})?$/;

export async function signAccessToken(deps: Deps, userId: string, sessionId: string) {
  const key = new TextEncoder().encode(deps.env.JWT_ACCESS_SECRET);
  return new SignJWT({ sid: sessionId })
    .setProtectedHeader({ alg: ALG, typ: 'JWT' })
    .setSubject(userId)
    .setIssuer(deps.env.JWT_ISSUER)
    .setAudience(deps.env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(key);
}

async function readToken(deps: Deps, header: string | undefined) {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7);
  if (token.length > 2048) return null;
  try {
    const key = new TextEncoder().encode(deps.env.JWT_ACCESS_SECRET);
    // algorithms is pinned so "alg: none" or RS/HS confusion cannot sneak in.
    const { payload } = await jwtVerify(token, key, {
      algorithms: [ALG],
      issuer: deps.env.JWT_ISSUER,
      audience: deps.env.JWT_AUDIENCE,
    });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') return null;
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

export function registerUserAuth(app: FastifyInstance, deps: Deps) {
  app.decorateRequest('user', null);
  app.decorateRequest('sessionId', null);
  app.decorateRequest('deviceId', null);
  app.decorateRequest('appVersion', null);

  app.addHook('onRequest', async (req) => {
    const device = req.headers['x-device-id'];
    if (typeof device === 'string' && DEVICE_ID.test(device)) req.deviceId = device;
    const ver = req.headers['x-app-version'];
    if (typeof ver === 'string' && APP_VERSION.test(ver)) req.appVersion = ver;

    if (req.url.startsWith('/admin')) return;
    const claims = await readToken(deps, req.headers.authorization);
    if (!claims) return;
    // Check the session too, so logout and "block user" take effect before
    // the 15-minute access token runs out.
    const session = await deps.db.session.findUnique({
      where: { id: claims.sessionId },
      select: { userId: true, revokedAt: true, replacedById: true, user: true },
    });
    if (!session || session.userId !== claims.userId) return;
    if (session.revokedAt) return;
    req.user = session.user;
    req.sessionId = claims.sessionId;
  });
}

// Use as preHandler on routes that need a signed-in, active user.
export async function requireUser(req: FastifyRequest) {
  if (!req.user) {
    if (req.headers.authorization) throw unauthorized('Your session has ended. Please sign in again.', 'SESSION_EXPIRED');
    throw unauthorized('Please sign in to continue', 'LOGIN_REQUIRED');
  }
  if (req.user.status === 'BLOCKED') throw unauthorized('This account has been blocked. Contact support.', 'ACCOUNT_BLOCKED');
  if (req.user.status === 'DELETED') throw unauthorized('This account has been deleted', 'ACCOUNT_DELETED');
}

export function currentUser(req: FastifyRequest): User {
  if (!req.user) throw unauthorized();
  return req.user;
}

export function makeAppCheckGuard(deps: Deps) {
  // Sensitive endpoints (login, contact, payments, list endpoints that bots love)
  // want proof that the call comes from the real app on a real phone.
  return async function requireAppCheck(req: FastifyRequest) {
    const token = req.headers['x-firebase-appcheck'];
    const ok = await deps.appCheck.verify(typeof token === 'string' ? token : undefined);
    if (ok) return;
    if (deps.env.APP_CHECK_ENFORCE) throw forbidden('Please update the app from Play Store', 'APP_CHECK_FAILED');
    req.log.warn({ route: req.routeOptions.url }, 'app check missing or invalid (not enforced)');
  };
}
