import { Queue } from 'bullmq';
import type { FastifyBaseLogger } from 'fastify';

export type JobName =
  | 'plan-expiry'
  | 'boosts'
  | 'payments-cleanup'
  | 'account-deletion'
  | 'retention'
  | 'requests-autoclose'
  | 'broadcast'
  | 'city-opened'
  | 'daily-summary';

export interface Jobs {
  enqueue(name: JobName, data: Record<string, unknown>): Promise<void>;
}

export const QUEUE_NAME = 'rentnook';

// Production: jobs go to Redis and the worker process (src/worker.ts) runs them.
export class QueueJobs implements Jobs {
  private queue: Queue;
  constructor(redisUrl: string) {
    this.queue = new Queue(QUEUE_NAME, { connection: { url: redisUrl } });
  }
  async enqueue(name: JobName, data: Record<string, unknown>) {
    await this.queue.add(name, data, { removeOnComplete: 1000, removeOnFail: 5000, attempts: 3, backoff: { type: 'exponential', delay: 5000 } });
  }
  close() {
    return this.queue.close();
  }
}

// Tests and simple local runs: run the job right away in-process.
export class InlineJobs implements Jobs {
  public ran: Array<{ name: JobName; data: Record<string, unknown> }> = [];
  private runner: ((name: JobName, data: Record<string, unknown>) => Promise<unknown>) | null = null;
  constructor(private log?: FastifyBaseLogger) {}
  bind(runner: (name: JobName, data: Record<string, unknown>) => Promise<unknown>) {
    this.runner = runner;
  }
  async enqueue(name: JobName, data: Record<string, unknown>) {
    this.ran.push({ name, data });
    try {
      await this.runner?.(name, data);
    } catch (err) {
      this.log?.error({ err, job: name }, 'inline job failed');
    }
  }
}
