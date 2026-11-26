import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import formbody from '@fastify/formbody';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { Deps } from './deps.ts';
import { isLive } from './config/env.ts';
import { registerAdminSession } from './plugins/admin-session.ts';
import { registerUserAuth } from './plugins/auth.ts';
import { registerErrorHandler } from './plugins/errors.ts';
import { registerLocalStorage } from './plugins/local-storage.ts';

import authRoutes from './modules/auth.ts';
import meRoutes from './modules/me.ts';
import catalogueRoutes from './modules/catalogue.ts';
import uploadRoutes from './modules/uploads.ts';
import listingRoutes from './modules/listings.ts';
import engagementRoutes from './modules/engagement.ts';
import notificationRoutes from './modules/notifications.ts';
import requestRoutes from './modules/requests.ts';
import planRoutes from './modules/plans.ts';
import paymentRoutes from './modules/payments.ts';
import referralRoutes from './modules/referral.ts';
import shopRoutes from './modules/shops.ts';
import idVerificationRoutes from './modules/id-verification.ts';
import shareCardRoutes from './modules/share-card.ts';
import adminAuthRoutes from './modules/admin/auth.ts';
import adminCatalogueRoutes from './modules/admin/catalogue.ts';
import adminModerationRoutes from './modules/admin/moderation.ts';
import adminUserRoutes from './modules/admin/users.ts';
import adminPlanRoutes from './modules/admin/plans.ts';
import adminPaymentRoutes from './modules/admin/payments.ts';
import adminCouponRoutes from './modules/admin/coupons.ts';
import adminOpsRoutes from './modules/admin/ops.ts';
import publicPages from './public-pages/routes.ts';

// Log redaction: none of these may ever reach the log files (section 21).
const REDACT = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-firebase-appcheck"]',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  '*.idToken',
  '*.refreshToken',
  '*.accessToken',
  '*.password',
  '*.phone',
  '*.utr',
  '*.code',
];

export async function buildApp(deps: Deps, opts: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const { env } = deps;
  const app = Fastify({
    logger:
      opts.logger === false
        ? false
        : {
            level: env.LOG_LEVEL,
            redact: { paths: REDACT, censor: '[redacted]' },
            // Only the parts listed in section 21: id, route, status, time, ip.
            serializers: {
              req: (r: FastifyRequest) => ({
                id: r.id,
                method: r.method,
                url: r.url.split('?')[0],
                ip: r.ip,
                appVersion: r.headers['x-app-version'],
              }),
              res: (r: { statusCode: number }) => ({ statusCode: r.statusCode }),
            },
          },
    trustProxy: env.TRUST_PROXY,
    bodyLimit: 1024 * 1024,
    requestIdHeader: false,
    genReqId: () => crypto.randomUUID(),
    routerOptions: { ignoreTrailingSlash: true, maxParamLength: 200 },
  });

  app.addHook('onRequest', async (req, reply) => {
    reply.header('X-Request-Id', req.id);
  });

  await app.register(helmet, {
    // API answers JSON; the few HTML pages use only our own CSS/JS.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        formAction: ["'self'"],
        baseUri: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    frameguard: { action: 'deny' },
    hsts: isLive(env) ? { maxAge: 31_536_000, includeSubDomains: true, preload: false } : false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginResourcePolicy: { policy: 'same-site' },
  });
  app.addHook('onSend', async (_req, reply) => {
    reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  });

  await app.register(cors, {
    // Only the admin site may call us from a browser. The app is not a browser.
    origin: (origin, cb) => cb(null, !origin || origin === env.ADMIN_ORIGIN ? (origin ?? false) : false),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'],
    maxAge: 600,
  });
  await app.register(cookie, { secret: env.ADMIN_SESSION_SECRET });
  await app.register(formbody);
  await app.register(rateLimit, {
    global: true,
    max: env.RATE_LIMIT_GLOBAL_PER_MIN,
    timeWindow: '1 minute',
    redis: deps.redis,
    nameSpace: 'rl-global:',
    keyGenerator: (req) => req.ip,
    skipOnError: false,
  });

  registerErrorHandler(app);
  registerUserAuth(app, deps);
  registerAdminSession(app, deps);
  registerLocalStorage(app, deps);

  app.get('/health', { config: { rateLimit: false } }, async () => {
    await deps.db.$queryRaw`SELECT 1`;
    await deps.redis.ping();
    return { ok: true };
  });

  for (const routes of [
    authRoutes, meRoutes, catalogueRoutes, uploadRoutes, listingRoutes, engagementRoutes, notificationRoutes, requestRoutes,
    planRoutes, paymentRoutes, referralRoutes, shopRoutes, idVerificationRoutes, shareCardRoutes,
    adminAuthRoutes, adminCatalogueRoutes, adminModerationRoutes, adminUserRoutes, adminPlanRoutes, adminPaymentRoutes,
    adminCouponRoutes, adminOpsRoutes, publicPages,
  ]) {
    await app.register(async (scope) => routes(scope, deps));
  }

  return app;
}
