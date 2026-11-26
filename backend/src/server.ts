import * as Sentry from '@sentry/node';
import { loadEnv } from './config/env.ts';
import { createDeps } from './deps.ts';
import { buildApp } from './app.ts';
import { QueueJobs } from './jobs/queue.ts';

const env = loadEnv();

if (env.SENTRY_DSN_BACKEND) {
  Sentry.init({
    dsn: env.SENTRY_DSN_BACKEND,
    environment: env.NODE_ENV,
    tracesSampleRate: 0,
    beforeSend(event) {
      // Strip anything that could carry personal data.
      delete event.user;
      if (event.request) {
        delete event.request.cookies;
        delete event.request.data;
        delete event.request.query_string;
        if (event.request.headers) {
          for (const h of ['authorization', 'cookie', 'x-firebase-appcheck', 'x-csrf-token']) delete event.request.headers[h];
        }
      }
      return event;
    },
  });
}

const jobs = new QueueJobs(env.REDIS_URL);
const deps = createDeps(env, jobs);
const app = await buildApp(deps);
if (env.SENTRY_DSN_BACKEND) Sentry.setupFastifyErrorHandler(app);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await jobs.close();
  await deps.db.$disconnect();
  deps.redis.disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

await app.listen({ port: env.PORT, host: env.HOST });
