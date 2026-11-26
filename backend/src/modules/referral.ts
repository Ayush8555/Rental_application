import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { currentUser, requireUser } from '../plugins/auth.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { badRequest, conflict } from '../lib/errors.ts';
import { DAY_MS } from '../lib/time.ts';
import { parse } from '../lib/validate.ts';
import { getSetting } from '../services/settings.ts';

const APPLY_WINDOW_DAYS = 14;

// Anti-farming rules (P5-03):
//  - the code cannot be your own, and an account takes one code, once
//  - only fairly new accounts can apply a code
//  - if the referee's phone (device id) was ever used by the referrer, it is
//    the same person with two SIMs: refused
//  - one device can be a referee only once
//  - the reward waits for the referee's first approved paid payment, and is
//    capped per month (billing.ts)
export async function applyReferral(deps: Deps, userId: string, rawCode: string, deviceId: string | null) {
  const code = rawCode.trim().toUpperCase();
  const user = await deps.db.user.findUniqueOrThrow({ where: { id: userId } });
  if (user.referralCode === code) throw badRequest('You cannot use your own code', 'OWN_CODE');
  if (Date.now() - user.createdAt.getTime() > APPLY_WINDOW_DAYS * DAY_MS) {
    throw badRequest('Referral codes can be used only in the first 14 days', 'TOO_LATE');
  }
  if (!deviceId) throw badRequest('Please update the app to use a referral code', 'DEVICE_REQUIRED');
  const existing = await deps.db.referral.findUnique({ where: { refereeId: userId } });
  if (existing) throw conflict('You have already used a referral code', 'ALREADY_APPLIED');
  const paid = await deps.db.payment.count({ where: { userId, status: 'APPROVED', amountPaise: { gt: 0 } } });
  if (paid) throw badRequest('Referral codes are for new listers only', 'NOT_NEW');

  const referrer = await deps.db.user.findUnique({ where: { referralCode: code } });
  if (!referrer || referrer.status !== 'ACTIVE') throw badRequest('This code is not valid', 'BAD_CODE');

  const sameDevice = await deps.db.session.count({ where: { userId: referrer.id, deviceId } });
  if (sameDevice) throw badRequest('This code cannot be used on this phone', 'SAME_DEVICE');
  const deviceUsed = await deps.db.referral.count({ where: { deviceId } });
  if (deviceUsed) throw badRequest('A referral code was already used on this phone', 'DEVICE_USED');

  const { referralRewardDays } = await getSetting(deps.db, 'limits');
  await deps.db.$transaction([
    deps.db.referral.create({ data: { referrerId: referrer.id, refereeId: userId, deviceId, rewardDays: referralRewardDays } }),
    deps.db.user.update({ where: { id: userId }, data: { referredById: referrer.id } }),
  ]);
  return { ok: true };
}

export default async function referralRoutes(app: FastifyInstance, deps: Deps) {
  app.get('/referral', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    const [rewarded, pending, mine] = await Promise.all([
      deps.db.referral.findMany({ where: { referrerId: user.id, status: 'REWARDED' }, select: { rewardDays: true } }),
      deps.db.referral.count({ where: { referrerId: user.id, status: 'PENDING' } }),
      deps.db.referral.findUnique({ where: { refereeId: user.id } }),
    ]);
    const { referralRewardDays } = await getSetting(deps.db, 'limits');
    return {
      code: user.referralCode,
      shareLink: `${deps.env.PUBLIC_WEB_URL}/r/${user.referralCode}`,
      rewardDays: referralRewardDays,
      rewardsEarned: rewarded.length,
      daysEarned: rewarded.reduce((n, r) => n + r.rewardDays, 0),
      pending,
      appliedCode: !!mine,
    };
  });

  app.post('/referral/apply', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'referral-apply', user.id, 5, 3600);
    const { code } = parse(z.object({ code: z.string().trim().regex(/^[A-Za-z0-9]{5,10}$/) }).strict(), req.body);
    return applyReferral(deps, user.id, code, req.deviceId);
  });
}
