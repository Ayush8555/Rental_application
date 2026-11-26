import type { FastifyRequest } from 'fastify';
import type { Deps } from '../deps.ts';
import { tooMany } from '../lib/errors.ts';
import { hit } from '../services/redis.ts';

// Small fixed-window limiter on top of Redis for the business limits that
// @fastify/rate-limit cannot express (per device, per phone, per user).
export async function enforceLimit(
  deps: Deps,
  bucket: string,
  id: string | null | undefined,
  max: number,
  windowSec: number,
  message?: string,
) {
  if (!id) return;
  const n = await hit(deps.redis, `rl:${bucket}:${id}`, windowSec);
  if (n > max) throw tooMany(message);
}

export function limitBy(
  deps: Deps,
  bucket: string,
  pick: (req: FastifyRequest) => string | null | undefined,
  max: () => number,
  windowSec: number,
  message?: string,
) {
  return async (req: FastifyRequest) => enforceLimit(deps, bucket, pick(req), max(), windowSec, message);
}
