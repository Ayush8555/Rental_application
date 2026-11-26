import { Worker } from 'bullmq';
import { loadEnv } from './config/env.ts';
import { createDeps } from './deps.ts';
import { makeRunner, SCHEDULES } from './jobs/handlers.ts';
import { QUEUE_NAME, QueueJobs, type JobName } from './jobs/queue.ts';

process.env.TZ = 'Asia/Kolkata';
const env = loadEnv();
const jobs = new QueueJobs(env.REDIS_URL);
const deps = createDeps(env, jobs);
const run = makeRunner(deps);

// Repeatable jobs. upsert is idempotent, so restarting the worker is safe.
const { Queue } = await import('bullmq');
const queue = new Queue(QUEUE_NAME, { connection: { url: env.REDIS_URL } });
for (const s of SCHEDULES) {
  await queue.upsertJobScheduler(s.name, { pattern: s.pattern, tz: 'Asia/Kolkata' }, { name: s.name, data: {} });
}

const worker = new Worker(
  QUEUE_NAME,
  async (job) => {
    const started = Date.now();
    const result = await run(job.name as JobName, job.data as Record<string, unknown>);
    console.warn(JSON.stringify({ level: 'info', job: job.name, ms: Date.now() - started, result }));
    return result;
  },
  { connection: { url: env.REDIS_URL }, concurrency: 2 },
);

worker.on('failed', (job, err) => {
  console.error(JSON.stringify({ level: 'error', job: job?.name, message: err.message }));
});

const stop = async () => {
  await worker.close();
  await queue.close();
  await jobs.close();
  await deps.db.$disconnect();
  deps.redis.disconnect();
  process.exit(0);
};
process.on('SIGTERM', () => void stop());
process.on('SIGINT', () => void stop());
