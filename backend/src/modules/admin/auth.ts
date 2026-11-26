import { randomInt } from 'node:crypto';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../../deps.ts';
import {
  actorOf,
  clearSessionCookie,
  createAdminSession,
  currentAdmin,
  requireStepUp,
  requireSuper,
  setSessionCookie,
} from '../../plugins/admin-session.ts';
import { decrypt, encrypt, sha256 } from '../../lib/crypto.ts';
import { AppError, badRequest, forbidden, notFound, unauthorized } from '../../lib/errors.ts';
import { randomToken } from '../../lib/ids.ts';
import { parse } from '../../lib/validate.ts';
import { audit } from '../../services/audit.ts';
import { hit } from '../../services/redis.ts';
import { burnTime, hashPassword, passwordProblem, verifyPassword } from './passwords.ts';

authenticator.options = { window: 1, step: 30, digits: 6 };

const LOCK_AFTER = 5;
const CAPTCHA_AFTER = 3;
const LOCK_SEC = 15 * 60;
const GENERIC = 'Email, password or code is wrong';

const loginBody = z
  .object({ email: z.email().max(200).toLowerCase(), password: z.string().min(1).max(200), captchaToken: z.string().max(2048).optional() })
  .strict();
const codeBody = z.object({ code: z.string().trim().regex(/^(\d{6}|[a-z0-9]{4}-[a-z0-9]{4})$/i) }).strict();

const locked = () => new AppError(423, 'LOCKED', 'Too many wrong tries. This account is locked for 15 minutes.');

const failKey = (email: string) => `admin-fail:${sha256(email)}`;
const lockKey = (email: string) => `admin-lock:${sha256(email)}`;

function backupCodes() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => {
    let s = '';
    for (let i = 0; i < 8; i++) s += alphabet[randomInt(alphabet.length)];
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

export default async function adminAuthRoutes(app: FastifyInstance, deps: Deps) {
  async function registerFailure(email: string, adminId: string | null, ip: string) {
    const n = await hit(deps.redis, failKey(email), LOCK_SEC);
    if (n >= LOCK_AFTER) {
      await deps.redis.set(lockKey(email), '1', 'EX', LOCK_SEC);
      await deps.redis.del(failKey(email));
      if (adminId) {
        await deps.db.admin.update({ where: { id: adminId }, data: { lockedUntil: new Date(Date.now() + LOCK_SEC * 1000), failedAttempts: n } });
      }
      // Alert: lands in the audit log (Super admin sees it) and the error tracker.
      await audit(deps.db, { id: null, type: 'system', ip }, 'admin.locked', 'Admin', adminId, null, { emailHash: sha256(email).slice(0, 12) });
      app.log.warn({ adminId, ip }, 'admin account locked after repeated failures');
    }
    return n;
  }

  async function isLocked(email: string) {
    return (await deps.redis.exists(lockKey(email))) === 1;
  }

  app.get('/admin/auth/config', async () => ({
    captchaSiteKey: deps.captcha.enabled ? deps.captcha.siteKey ?? null : null,
  }));

  app.post('/admin/auth/login', async (req, reply) => {
    const body = parse(loginBody, req.body);
    if (await isLocked(body.email)) {
      throw locked();
    }
    const fails = Number((await deps.redis.get(failKey(body.email))) ?? 0);
    if (fails >= CAPTCHA_AFTER && deps.captcha.enabled) {
      const ok = await deps.captcha.verify(body.captchaToken, req.ip);
      if (!ok) throw badRequest('Please complete the check below', 'CAPTCHA_REQUIRED', { captchaRequired: true });
    }

    const admin = await deps.db.admin.findUnique({ where: { email: body.email } });
    const passOk = admin?.passwordHash ? await verifyPassword(admin.passwordHash, body.password) : (await burnTime(body.password), false);
    if (!admin || !passOk || admin.disabledAt) {
      const n = await registerFailure(body.email, admin?.id ?? null, req.ip);
      throw new AppError(401, 'BAD_LOGIN', GENERIC, { captchaRequired: n >= CAPTCHA_AFTER && deps.captcha.enabled });
    }

    const { token, session } = await createAdminSession(deps, admin.id, req, false);
    setSessionCookie(deps, reply, token);
    return { stage: admin.totpEnabled ? '2fa' : 'totp-setup', csrfToken: session.csrfToken };
  });

  app.post('/admin/auth/2fa', async (req, reply) => {
    const admin = currentAdmin(req);
    const session = req.adminSession!;
    if (!admin.totpEnabled || !admin.totpSecretEnc) throw badRequest('Set up the authenticator first', 'TOTP_NOT_SET');
    if (await isLocked(admin.email)) throw locked();
    const { code } = parse(codeBody, req.body);

    let ok = false;
    if (/^\d{6}$/.test(code)) {
      ok = authenticator.check(code, decrypt(deps.env.TOTP_ENC_KEY, admin.totpSecretEnc));
      // Same code cannot be used twice inside its 30 s window.
      if (ok) ok = (await deps.redis.set(`totp-used:${admin.id}:${code}`, '1', 'EX', 90, 'NX')) === 'OK';
    } else {
      for (const h of admin.backupCodes) {
        if (await verifyPassword(h, code.toLowerCase())) {
          ok = true;
          await deps.db.admin.update({ where: { id: admin.id }, data: { backupCodes: admin.backupCodes.filter((x) => x !== h) } });
          break;
        }
      }
    }
    if (!ok) {
      await registerFailure(admin.email, admin.id, req.ip);
      throw unauthorized(GENERIC, 'BAD_CODE');
    }

    // New session id after login (no session fixation), old one revoked.
    await deps.db.adminSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } });
    const { token, session: fresh } = await createAdminSession(deps, admin.id, req, true);
    await deps.db.adminSession.update({ where: { id: fresh.id }, data: { stepUpAt: new Date() } });
    setSessionCookie(deps, reply, token);
    await deps.redis.del(failKey(admin.email));
    await deps.db.admin.update({ where: { id: admin.id }, data: { lastLoginAt: new Date(), failedAttempts: 0, lockedUntil: null } });
    await audit(deps.db, { ...actorOf(req), id: admin.id }, 'admin.login', 'Admin', admin.id);
    return { ok: true, csrfToken: fresh.csrfToken };
  });

  app.post('/admin/auth/totp-setup/start', async (req) => {
    const admin = currentAdmin(req);
    if (admin.totpEnabled) throw badRequest('2-step login is already set up', 'TOTP_SET');
    const secret = authenticator.generateSecret(20);
    await deps.db.admin.update({ where: { id: admin.id }, data: { totpSecretEnc: encrypt(deps.env.TOTP_ENC_KEY, secret) } });
    const uri = authenticator.keyuri(admin.email, 'RentNook Admin', secret);
    return { otpauthUrl: uri, qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }), secret };
  });

  app.post('/admin/auth/totp-setup/confirm', async (req, reply) => {
    const admin = currentAdmin(req);
    if (admin.totpEnabled || !admin.totpSecretEnc) throw badRequest('Start the setup again', 'TOTP_SET');
    const { code } = parse(codeBody, req.body);
    if (!/^\d{6}$/.test(code) || !authenticator.check(code, decrypt(deps.env.TOTP_ENC_KEY, admin.totpSecretEnc))) {
      await registerFailure(admin.email, admin.id, req.ip);
      throw badRequest('That code did not match. Check the time on your phone and try again.', 'BAD_CODE');
    }
    const codes = backupCodes();
    await deps.db.admin.update({
      where: { id: admin.id },
      data: { totpEnabled: true, backupCodes: await Promise.all(codes.map((c) => hashPassword(c))), lastLoginAt: new Date() },
    });
    await deps.db.adminSession.update({ where: { id: req.adminSession!.id }, data: { revokedAt: new Date() } });
    const { token, session } = await createAdminSession(deps, admin.id, req, true);
    setSessionCookie(deps, reply, token);
    await audit(deps.db, { ...actorOf(req), id: admin.id }, 'admin.totp_enabled', 'Admin', admin.id);
    // Shown once. Only hashes are stored.
    return { backupCodes: codes, csrfToken: session.csrfToken };
  });

  app.post('/admin/auth/step-up', async (req) => {
    const admin = currentAdmin(req);
    const { code } = parse(codeBody, req.body);
    const ok =
      /^\d{6}$/.test(code) &&
      !!admin.totpSecretEnc &&
      authenticator.check(code, decrypt(deps.env.TOTP_ENC_KEY, admin.totpSecretEnc)) &&
      (await deps.redis.set(`totp-used:${admin.id}:${code}`, '1', 'EX', 90, 'NX')) === 'OK';
    if (!ok) {
      await registerFailure(admin.email, admin.id, req.ip);
      throw unauthorized('That code did not match', 'BAD_CODE');
    }
    await deps.db.adminSession.update({ where: { id: req.adminSession!.id }, data: { stepUpAt: new Date() } });
    return { ok: true };
  });

  app.get('/admin/auth/me', async (req) => {
    const admin = currentAdmin(req);
    const s = req.adminSession!;
    return {
      admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role, totpEnabled: admin.totpEnabled },
      stage: s.mfaPassed ? 'ready' : admin.totpEnabled ? '2fa' : 'totp-setup',
      csrfToken: s.csrfToken,
      expiresAt: s.expiresAt,
    };
  });

  app.post('/admin/auth/logout', async (req, reply) => {
    if (req.adminSession) await deps.db.adminSession.update({ where: { id: req.adminSession.id }, data: { revokedAt: new Date() } });
    clearSessionCookie(deps, reply);
    return { ok: true };
  });

  app.get('/admin/auth/sessions', async (req) => {
    const admin = currentAdmin(req);
    const rows = await deps.db.adminSession.findMany({
      where: { adminId: admin.id, revokedAt: null, expiresAt: { gt: new Date() }, mfaPassed: true },
      orderBy: { lastSeenAt: 'desc' },
      take: 20,
    });
    return {
      items: rows.map((s) => ({ id: s.id, ip: s.ip, userAgent: s.userAgent, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt, current: s.id === req.adminSession!.id })),
    };
  });

  app.delete('/admin/auth/sessions/:id', async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    await deps.db.adminSession.updateMany({ where: { id, adminId: currentAdmin(req).id }, data: { revokedAt: new Date() } });
    return { ok: true };
  });

  // ------------------------------------------------------------ staff accounts (W-02)

  app.get('/admin/admins', { preHandler: requireSuper }, async () => {
    const rows = await deps.db.admin.findMany({ orderBy: { createdAt: 'asc' } });
    const invites = await deps.db.adminInvite.findMany({ where: { usedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
    return {
      items: rows.map((a) => ({ id: a.id, name: a.name, email: a.email, role: a.role, lastLoginAt: a.lastLoginAt, disabled: !!a.disabledAt, totpEnabled: a.totpEnabled })),
      invites: invites.map((i) => ({ id: i.id, email: i.email, name: i.name, role: i.role, expiresAt: i.expiresAt })),
    };
  });

  app.post('/admin/admins', { preHandler: [requireSuper, requireStepUp] }, async (req) => {
    const body = parse(
      z.object({ email: z.email().max(200).toLowerCase(), name: z.string().trim().min(2).max(60), role: z.enum(['ADMIN', 'SUPER_ADMIN']) }).strict(),
      req.body,
    );
    if (await deps.db.admin.findUnique({ where: { email: body.email } })) throw badRequest('This email already has an account', 'EXISTS');
    const token = randomToken(32);
    const invite = await deps.db.adminInvite.create({
      data: { ...body, tokenHash: sha256(token), invitedById: currentAdmin(req).id, expiresAt: new Date(Date.now() + 24 * 3600 * 1000) },
    });
    await audit(deps.db, actorOf(req), 'admin.invite', 'AdminInvite', invite.id, null, { email: body.email, role: body.role });
    // No mail service yet: the Super admin shares this link privately.
    return { inviteUrl: `${deps.env.ADMIN_ORIGIN}/accept-invite#${token}`, expiresAt: invite.expiresAt };
  });

  app.patch('/admin/admins/:id', { preHandler: [requireSuper, requireStepUp] }, async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const body = parse(z.object({ role: z.enum(['ADMIN', 'SUPER_ADMIN']).optional(), disabled: z.boolean().optional() }).strict(), req.body);
    if (id === currentAdmin(req).id) throw forbidden('You cannot change your own account here');
    const before = await deps.db.admin.findUnique({ where: { id } });
    if (!before) throw notFound();
    if ((body.disabled || body.role === 'ADMIN') && before.role === 'SUPER_ADMIN') {
      const supers = await deps.db.admin.count({ where: { role: 'SUPER_ADMIN', disabledAt: null } });
      if (supers <= 1) throw badRequest('There must always be one active Super admin', 'LAST_SUPER');
    }
    const after = await deps.db.admin.update({
      where: { id },
      data: { role: body.role, disabledAt: body.disabled === undefined ? undefined : body.disabled ? new Date() : null },
    });
    // Disabled staff are thrown out right away, not at their next idle timeout.
    if (body.disabled) await deps.db.adminSession.updateMany({ where: { adminId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (body.role && body.role !== before.role) await deps.db.adminSession.updateMany({ where: { adminId: id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(deps.db, actorOf(req), 'admin.update', 'Admin', id, { role: before.role, disabled: !!before.disabledAt }, { role: after.role, disabled: !!after.disabledAt });
    return { ok: true };
  });

  app.delete('/admin/admins/invites/:id', { preHandler: requireSuper }, async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    await deps.db.adminInvite.updateMany({ where: { id, usedAt: null }, data: { expiresAt: new Date() } });
    await audit(deps.db, actorOf(req), 'admin.invite_cancel', 'AdminInvite', id);
    return { ok: true };
  });

  app.post('/admin/auth/invite', async (req) => {
    const { token } = parse(z.object({ token: z.string().min(20).max(100) }).strict(), req.body);
    const invite = await deps.db.adminInvite.findUnique({ where: { tokenHash: sha256(token) } });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) throw notFound('This invite link has expired', 'INVITE_GONE');
    return { email: invite.email, name: invite.name, role: invite.role };
  });

  app.post('/admin/auth/accept-invite', async (req) => {
    const body = parse(z.object({ token: z.string().min(20).max(100), password: z.string().min(1).max(200) }).strict(), req.body);
    const invite = await deps.db.adminInvite.findUnique({ where: { tokenHash: sha256(body.token) } });
    if (!invite || invite.usedAt || invite.expiresAt < new Date()) throw notFound('This invite link has expired', 'INVITE_GONE');
    const problem = passwordProblem(body.password, invite.email);
    if (problem) throw badRequest(problem, 'WEAK_PASSWORD');
    const used = await deps.db.adminInvite.updateMany({ where: { id: invite.id, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw notFound('This invite link has expired', 'INVITE_GONE');
    const admin = await deps.db.admin.create({
      data: { email: invite.email, name: invite.name, role: invite.role, passwordHash: await hashPassword(body.password) },
    });
    await audit(deps.db, { id: admin.id, ip: req.ip }, 'admin.created', 'Admin', admin.id, null, { email: admin.email, role: admin.role, invitedBy: invite.invitedById });
    return { ok: true };
  });
}
