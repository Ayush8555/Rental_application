import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../../deps.ts';
import { actorOf, requireAdmin } from '../../plugins/admin-session.ts';
import { badRequest, notFound } from '../../lib/errors.ts';
import { maskPhone } from '../../lib/phone.ts';
import { parse } from '../../lib/validate.ts';
import { audit } from '../../services/audit.ts';
import { approvePayment, rejectPayment } from '../billing.ts';
import { idParams, pageQuery, paging } from './common.ts';

export const REJECT_REASONS = [
  'UTR not found in bank statement',
  'Amount does not match',
  'Payment went to a different UPI ID',
  'Screenshot does not match the UTR',
  'Duplicate payment',
] as const;

const IDEM_TTL = 24 * 3600;

export default async function adminPaymentRoutes(app: FastifyInstance, deps: Deps) {
  app.get('/admin/payments', { preHandler: requireAdmin }, async (req) => {
    const q = parse(z.object({ ...pageQuery, tab: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'), utr: z.string().regex(/^\d{4,12}$/).optional() }).strict(), req.query);
    const where = { status: q.tab, ...(q.utr ? { utr: { endsWith: q.utr } } : {}) };
    const [rows, total] = await Promise.all([
      deps.db.payment.findMany({
        where,
        orderBy: q.tab === 'PENDING' ? { submittedAt: 'asc' } : { reviewedAt: 'desc' },
        ...paging(q),
        include: { user: { select: { id: true, name: true, phone: true, createdAt: true } }, subscription: { select: { planName: true } }, boost: { select: { days: true, listing: { select: { title: true } } } }, coupon: { select: { code: true } } },
      }),
      deps.db.payment.count({ where }),
    ]);

    // Flag UTRs that also appear on someone else's payment attempt.
    const utrs = rows.map((r) => r.utr).filter((u): u is string => !!u);
    const attempts = await deps.db.utrAttempt.findMany({ where: { utr: { in: utrs } } });
    const owner = new Map(attempts.map((a) => [a.utr, a.paymentId]));
    const history = await deps.db.payment.groupBy({ by: ['userId', 'status'], where: { userId: { in: rows.map((r) => r.userId) } }, _count: true });

    return {
      total,
      rejectReasons: REJECT_REASONS,
      items: rows.map((p) => ({
        id: p.id,
        reference: p.shortRef,
        purpose: p.purpose,
        what: p.subscription?.planName ?? (p.boost ? `Boost ${p.boost.days} days — ${p.boost.listing.title}` : ''),
        listPricePaise: p.listPricePaise,
        discountPaise: p.discountPaise,
        amountPaise: p.amountPaise,
        coupon: p.coupon?.code ?? null,
        utr: p.utr,
        duplicateUtr: !!p.utr && owner.has(p.utr) && owner.get(p.utr) !== p.id,
        hasScreenshot: !!p.screenshotKey,
        status: p.status,
        rejectReason: p.rejectReason,
        submittedAt: p.submittedAt,
        reviewedAt: p.reviewedAt,
        submitCount: p.submitCount,
        user: {
          id: p.user.id,
          name: p.user.name,
          phoneMasked: maskPhone(p.user.phone),
          since: p.user.createdAt,
          history: Object.fromEntries(history.filter((h) => h.userId === p.userId).map((h) => [h.status, h._count])),
        },
      })),
    };
  });

  // 10-minute signed link, logged. The screenshot is supporting evidence only;
  // the bank statement is the source of truth.
  app.get('/admin/payments/:id/screenshot', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const p = await deps.db.payment.findUnique({ where: { id } });
    if (!p?.screenshotKey) throw notFound('No screenshot');
    await audit(deps.db, actorOf(req), 'payment.view_screenshot', 'Payment', id);
    return { url: await deps.storage.signGet('private', p.screenshotKey, 600) };
  });

  app.post('/admin/payments/:id/approve', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || !/^[A-Za-z0-9-]{16,64}$/.test(key)) throw badRequest('Missing idempotency key', 'IDEMPOTENCY_KEY');
    const idemKey = `idem:approve:${req.admin!.id}:${key}`;
    const prior = await deps.redis.get(idemKey);
    if (prior) return JSON.parse(prior) as unknown;

    const result = await approvePayment(deps, id, actorOf(req));
    const response = { ok: true, paymentId: result.paymentId, boost: result.boost?.status ?? null };
    await deps.redis.set(idemKey, JSON.stringify(response), 'EX', IDEM_TTL);

    // Notifications after commit; failures here never undo an approval.
    await deps.notifier.toUser(result.userId, 'PAYMENT_APPROVED', { what: result.what }, { paymentId: id }).catch(() => undefined);
    if (result.boost?.status === 'ACTIVE') {
      await deps.notifier.toUser(result.userId, 'BOOST_STARTED', { title: result.boost.listingTitle, date: result.boost.endsAt!.toISOString().slice(0, 10) }).catch(() => undefined);
    }
    if (result.referral) {
      await deps.notifier.toUser(result.referral.referrerId, 'REFERRAL_REWARD', { days: result.referral.days }).catch(() => undefined);
    }
    return response;
  });

  app.post('/admin/payments/:id/reject', { preHandler: requireAdmin }, async (req) => {
    const { id } = parse(idParams, req.params);
    const { reason } = parse(z.object({ reason: z.string().trim().min(3).max(200) }).strict(), req.body);
    const p = await rejectPayment(deps, id, reason, actorOf(req));
    await deps.notifier.toUser(p.userId, 'PAYMENT_REJECTED', { reason }, { paymentId: id }).catch(() => undefined);
    return { ok: true };
  });
}
