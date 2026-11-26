import type { FastifyBaseLogger } from 'fastify';
import type { Env } from './config/env.ts';
import { createCaptcha, type Captcha } from './services/captcha.ts';
import { createDb, type Db } from './services/db.ts';
import { Notifier } from './services/notify.ts';
import { createAppCheck, createPhoneAuth, type AppCheck, type PhoneAuth } from './services/phone-auth.ts';
import { createPush, type Push } from './services/push.ts';
import { createRedis, type RedisClient } from './services/redis.ts';
import { createStorage, type Storage } from './services/storage.ts';
import type { Jobs } from './jobs/queue.ts';

// Everything a route or job needs, built once at start-up. Tests build their
// own Deps with fakes where a real service is not available offline.
export interface Deps {
  env: Env;
  db: Db;
  redis: RedisClient;
  storage: Storage;
  phoneAuth: PhoneAuth;
  appCheck: AppCheck;
  push: Push;
  captcha: Captcha;
  notifier: Notifier;
  jobs: Jobs;
}

export function createDeps(env: Env, jobs: Jobs, log?: FastifyBaseLogger): Deps {
  const db = createDb(env.DATABASE_URL);
  const push = createPush(env, log);
  return {
    env,
    db,
    redis: createRedis(env.REDIS_URL),
    storage: createStorage(env),
    phoneAuth: createPhoneAuth(env),
    appCheck: createAppCheck(env),
    push,
    captcha: createCaptcha(env),
    notifier: new Notifier(db, push),
    jobs,
  };
}
