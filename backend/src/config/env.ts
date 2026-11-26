import { z } from 'zod';

const bool = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
    PORT: z.coerce.number().int().default(4000),
    HOST: z.string().default('0.0.0.0'),
    APP_BASE_URL: z.url().default('http://localhost:4000'),
    PUBLIC_WEB_URL: z.url().default('http://localhost:4000'),
    ADMIN_ORIGIN: z.url().default('http://localhost:5173'),
    TRUST_PROXY: bool.default(false),

    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().default('redis://localhost:6379'),

    JWT_ACCESS_SECRET: z.string().min(32),
    JWT_ISSUER: z.string().default('rentnook-api'),
    JWT_AUDIENCE: z.string().default('rentnook-app'),
    REFRESH_TOKEN_PEPPER: z.string().min(32),
    ADMIN_SESSION_SECRET: z.string().min(32),
    CSRF_SECRET: z.string().min(32),
    // 32 bytes, base64. Encrypts admin TOTP secrets at rest.
    TOTP_ENC_KEY: z.string().min(40),
    // Signs local-storage URLs (dev only) and share-card links.
    URL_SIGNING_SECRET: z.string().min(32),

    // "dev" accepts fake tokens like dev:+919812345678. Refused in production.
    AUTH_PROVIDER: z.enum(['firebase', 'dev']).default('dev'),
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_SERVICE_ACCOUNT_JSON: z.string().optional(),
    APP_CHECK_ENFORCE: bool.default(false),

    STORAGE_DRIVER: z.enum(['s3', 'local']).default('local'),
    STORAGE_LOCAL_DIR: z.string().default('./.data/storage'),
    STORAGE_ENDPOINT: z.string().optional(),
    STORAGE_REGION: z.string().default('ap-south-1'),
    STORAGE_KEY: z.string().optional(),
    STORAGE_SECRET: z.string().optional(),
    STORAGE_FORCE_PATH_STYLE: bool.default(false),
    BUCKET_PHOTOS: z.string().default('photos-dev'),
    BUCKET_PRIVATE_DOCS: z.string().default('private-docs-dev'),

    PUSH_PROVIDER: z.enum(['fcm', 'log']).default('log'),
    CAPTCHA_PROVIDER: z.enum(['turnstile', 'off']).default('off'),
    TURNSTILE_SECRET: z.string().optional(),
    TURNSTILE_SITE_KEY: z.string().optional(),

    // Firebase web config for the public delete-account page.
    FIREBASE_WEB_API_KEY: z.string().optional(),
    FIREBASE_WEB_AUTH_DOMAIN: z.string().optional(),

    ANDROID_PACKAGE: z.string().default('in.rentnook.app'),
    ANDROID_CERT_SHA256: z.string().default(''),
    PLAY_STORE_URL: z.string().default('https://play.google.com/store/apps/details?id=in.rentnook.app'),

    ADMIN_IP_ALLOWLIST: z.string().default(''),
    SENTRY_DSN_BACKEND: z.string().optional(),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

    RATE_LIMIT_GLOBAL_PER_MIN: z.coerce.number().int().default(100),
    RATE_LIMIT_AUTH_IP_PER_MIN: z.coerce.number().int().default(10),
    RATE_LIMIT_AUTH_DEVICE_PER_MIN: z.coerce.number().int().default(5),
    RATE_LIMIT_SEARCH_PER_MIN: z.coerce.number().int().default(60),
  })
  .superRefine((env, ctx) => {
    const live = env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
    if (!live) return;
    if (env.AUTH_PROVIDER !== 'firebase') {
      ctx.addIssue({ code: 'custom', path: ['AUTH_PROVIDER'], message: 'must be firebase outside dev/test' });
    }
    if (env.STORAGE_DRIVER !== 's3') {
      ctx.addIssue({ code: 'custom', path: ['STORAGE_DRIVER'], message: 'must be s3 outside dev/test' });
    }
    if (!env.FIREBASE_PROJECT_ID) {
      ctx.addIssue({ code: 'custom', path: ['FIREBASE_PROJECT_ID'], message: 'required' });
    }
    if (env.NODE_ENV === 'production') {
      if (!env.APP_CHECK_ENFORCE) {
        ctx.addIssue({ code: 'custom', path: ['APP_CHECK_ENFORCE'], message: 'must be true in production' });
      }
      if (env.PUSH_PROVIDER !== 'fcm') {
        ctx.addIssue({ code: 'custom', path: ['PUSH_PROVIDER'], message: 'must be fcm in production' });
      }
      if (env.CAPTCHA_PROVIDER !== 'turnstile') {
        ctx.addIssue({ code: 'custom', path: ['CAPTCHA_PROVIDER'], message: 'must be turnstile in production' });
      }
    }
    for (const k of ['JWT_ACCESS_SECRET', 'REFRESH_TOKEN_PEPPER', 'ADMIN_SESSION_SECRET', 'CSRF_SECRET'] as const) {
      if (env[k].includes('change-me') || env[k].length < 64) {
        ctx.addIssue({ code: 'custom', path: [k], message: 'use a random value of 64+ characters' });
      }
    }
  });

export type Env = z.infer<typeof schema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    // Print names only. Values may be secrets.
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment:\n${problems}`);
  }
  return parsed.data;
}

export const isLive = (env: Env) => env.NODE_ENV === 'production' || env.NODE_ENV === 'staging';
