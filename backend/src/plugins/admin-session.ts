import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Deps } from '../deps.ts';
import { isLive } from '../config/env.ts';
import { safeEqual, sha256 } from '../lib/crypto.ts';
import { forbidden, unauthorized } from '../lib/errors.ts';
import { randomToken } from '../lib/ids.ts';
import type { Admin, AdminRole, AdminSession } from '../services/db.ts';
import type { AuditActor } from '../services/audit.ts';

export const SESSION_MAX_MS = 8 * 60 * 60 * 1000;
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const STEP_UP_MS = 5 * 60 * 1000;

declare module 'fastify' {
  interface FastifyRequest {
    admin: Admin | null;
    adminSession: AdminSession | null;
  }
}

// Routes reachable before the TOTP step is done.
const PRE_MFA = new Set([
  '/admin/auth/me',
  '/admin/auth/2fa',
  '/admin/auth/totp-setup/start',
  '/admin/auth/totp-setup/confirm',
  '/admin/auth/logout',
]);
// Routes reachable with no session at all.
const PUBLIC = new Set(['/admin/auth/login', '/admin/auth/invite', '/admin/auth/accept-invite', '/admin/auth/config']);

export function cookieName(deps: Deps) {
  // __Host- prefix: browser only accepts it with Secure, Path=/ and no Domain,
  // so a sibling sub-domain cannot plant or overwrite it.
  return isLive(deps.env) ? '__Host-rn_admin' : 'rn_admin';
}

export function setSessionCookie(deps: Deps, reply: FastifyReply, token: string) {
  reply.setCookie(cookieName(deps), token, {
    httpOnly: true,
    secure: isLive(deps.env),
    sameSite: 'strict',
    path: '/',
    maxAge: SESSION_MAX_MS / 1000,
  });
}

export function clearSessionCookie(deps: Deps, reply: FastifyReply) {
  reply.clearCookie(cookieName(deps), { path: '/', httpOnly: true, secure: isLive(deps.env), sameSite: 'strict' });
}

export async function createAdminSession(deps: Deps, adminId: string, req: FastifyRequest, mfaPassed: boolean) {
  const token = randomToken(32);
  const session = await deps.db.adminSession.create({
    data: {
      adminId,
      tokenHash: sha256(token),
      csrfToken: randomToken(24),
      mfaPassed,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.slice(0, 300) ?? null,
      expiresAt: new Date(Date.now() + SESSION_MAX_MS),
    },
  });
  return { token, session };
}

export const actorOf = (req: FastifyRequest): AuditActor => ({
  id: req.admin?.id ?? null,
  type: 'admin',
  ip: req.ip,
  userAgent: req.headers['user-agent'] ?? null,
});

function routePath(req: FastifyRequest) {
  return (req.routeOptions.url ?? req.url.split('?')[0] ?? '').replace(/\/:[^/]+/g, '');
}

export function registerAdminSession(app: FastifyInstance, deps: Deps) {
  app.decorateRequest('admin', null);
  app.decorateRequest('adminSession', null);

  const allow = deps.env.ADMIN_IP_ALLOWLIST.split(',').map((s) => s.trim()).filter(Boolean);
  const unsafe = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/admin/')) return;
    if (allow.length && !allow.includes(req.ip)) throw forbidden();

    // Cross-site request guard #1: the browser's Origin must be our admin site.
    if (unsafe.has(req.method)) {
      const origin = req.headers.origin;
      if (!origin || origin !== deps.env.ADMIN_ORIGIN) throw forbidden('Request blocked', 'BAD_ORIGIN');
    }

    const path = routePath(req);
    const token = req.cookies[cookieName(deps)];
    if (token && token.length < 100) {
      const session = await deps.db.adminSession.findUnique({ where: { tokenHash: sha256(token) }, include: { admin: true } });
      const now = Date.now();
      const valid =
        session &&
        !session.revokedAt &&
        session.expiresAt.getTime() > now &&
        now - session.lastSeenAt.getTime() < SESSION_IDLE_MS &&
        !session.admin.disabledAt;
      if (session && valid) {
        req.admin = session.admin;
        req.adminSession = session;
        // Write lastSeenAt at most once a minute.
        if (now - session.lastSeenAt.getTime() > 60_000) {
          await deps.db.adminSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
        }
      } else if (session && !session.revokedAt) {
        await deps.db.adminSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
      }
    }

    if (PUBLIC.has(path) || path.startsWith('/admin/auth/invite')) return;
    if (!req.admin || !req.adminSession) throw unauthorized('Please sign in', 'ADMIN_LOGIN_REQUIRED');
    if (!req.adminSession.mfaPassed && !PRE_MFA.has(path)) throw unauthorized('Enter your 2-step code', 'MFA_REQUIRED');

    // Cross-site request guard #2: per-session CSRF token in a header that a
    // form on another site cannot set.
    if (unsafe.has(req.method)) {
      const sent = req.headers['x-csrf-token'];
      if (typeof sent !== 'string' || !safeEqual(sent, req.adminSession.csrfToken)) {
        throw forbidden('Your session check failed. Reload the page.', 'CSRF');
      }
    }
  });
}

// ---------------------------------------------------------------- guards

export function requireRole(role: AdminRole) {
  return async (req: FastifyRequest) => {
    if (!req.admin) throw unauthorized('Please sign in', 'ADMIN_LOGIN_REQUIRED');
    if (role === 'SUPER_ADMIN' && req.admin.role !== 'SUPER_ADMIN') throw forbidden('Only a Super admin can do this', 'SUPER_ADMIN_ONLY');
  };
}

export const requireAdmin = requireRole('ADMIN');
export const requireSuper = requireRole('SUPER_ADMIN');

// Sensitive actions (UPI change, giving paid plans, adding admins) need a
// fresh 2-step code from the last 5 minutes.
export async function requireStepUp(req: FastifyRequest) {
  const at = req.adminSession?.stepUpAt?.getTime() ?? 0;
  if (Date.now() - at > STEP_UP_MS) throw forbidden('Enter your 2-step code again to continue', 'STEP_UP_REQUIRED');
}

export function currentAdmin(req: FastifyRequest): Admin {
  if (!req.admin) throw unauthorized();
  return req.admin;
}
