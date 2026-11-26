import { Redis } from 'ioredis';

export type RedisClient = Redis;

export function createRedis(url: string): Redis {
  return new Redis(url, { maxRetriesPerRequest: 3, enableAutoPipelining: true, lazyConnect: false });
}

// Fixed-window counter. Returns the new count; the key expires with the window.
export async function hit(redis: Redis, key: string, windowSec: number): Promise<number> {
  const n = await redis.incr(key);
  if (n === 1) await redis.expire(key, windowSec);
  return n;
}
