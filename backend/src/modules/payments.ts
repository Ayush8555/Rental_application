import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { currentUser, makeAppCheckGuard, requireUser } from '../plugins/auth.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { badRequest, conflict, notFound } from '../lib/errors.ts';
import { istDay } from '../lib/time.ts';
import { parse } from '../lib/validate.ts';
import { Prisma } from '../services/db.ts';
import { getSetting } from '../services/settings.ts';
import { claimUploads } from './uploads.ts';
import { serializePayment, upiDetails } from './plans.ts';

const proofBody = z
  .object({
    // UPI UTR / RRN is always 12 digits.
    utr: z.string().trim().regex(/^\d{12}$/, 'UTR must be exactly 12 digits'),
    screenshotUploadId: z.uuid().optional(),
  })
  .strict();

const MAX_RESUBMITS = 5;

export default async function paymentRoutes(app: FastifyInstance, deps: Deps) {
  const appCheck = makeAppCheckGuard(deps);

  app.get('/payments/mine', { preHandler: requireUser }, async (req) => {
    const rows = await deps.db.payment.findMany({
      where: { userId: currentUser(req).id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { subscription: true },
    });
    return { items: rows.map(serializePayment) };
  });

  app.get('/payments/:id', { preHandler: requireUser }, async (req) => {
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const p = await deps.db.payment.findFirst({ where: { id, userId: currentUser(req).id }, include: { subscription: true } });
    if (!p) throw notFound('Payment not found');
    const open = p.status === 'CREATED' || p.status === 'REJECTED';
    return { ...serializePayment(p), upi: open ? await upiDetails(deps, p) : null };
  });

  app.post('/payments/:id/proof', { preHandler: [requireUser, appCheck] }, async (req) => {
    const user = currentUser(req);
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const body = parse(proofBody, req.body);
    const { utrPerDay } = await getSetting(deps.db, 'limits');
    await enforceLimit(deps, `utr:${istDay()}`, user.id, utrPerDay, 26 * 3600, 'Too many UTR submissions today. Please try tomorrow.');

    const p = await deps.db.payment.findFirst({ where: { id, userId: user.id } });
    if (!p) throw notFound('Payment not found');
    if (p.status !== 'CREATED' && p.status !== 'REJECTED') throw conflict('This payment is already submitted', 'ALREADY_SUBMITTED');
    if (p.submitCount >= MAX_RESUBMITS) throw badRequest('Please contact support about this payment', 'TOO_MANY_TRIES');

    let screenshotKey: string | null = p.screenshotKey;
    if (body.screenshotUploadId) {
      const [u] = await claimUploads(deps, user.id, [body.screenshotUploadId], 'proof');
      screenshotKey = u!.finalKey!;
    }

    try {
      await deps.db.$transaction(async (tx) => {
        // UtrAttempt is keyed by UTR: a number used on any payment, approved or
        // rejected, can only ever come back on that same payment.
        const seen = await tx.utrAttempt.findUnique({ where: { utr: body.utr } });
        if (seen && seen.paymentId !== p.id) {
          throw conflict('This UTR has already been used', 'UTR_USED');
        }
        if (!seen) await tx.utrAttempt.create({ data: { utr: body.utr, paymentId: p.id, userId: user.id } });
        const res = await tx.payment.updateMany({
          where: { id: p.id, status: { in: ['CREATED', 'REJECTED'] } },
          data: { utr: body.utr, screenshotKey, status: 'PENDING', submittedAt: new Date(), submitCount: { increment: 1 }, rejectReason: null },
        });
        if (res.count !== 1) throw conflict('This payment is already submitted', 'ALREADY_SUBMITTED');
        if (body.screenshotUploadId) {
          await tx.upload.update({ where: { id: body.screenshotUploadId }, data: { status: 'ATTACHED' } });
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        req.log.warn({ userId: user.id, paymentId: p.id }, 'duplicate UTR submitted');
        throw conflict('This UTR has already been used', 'UTR_USED');
      }
      if ((err as { code?: string }).code === 'UTR_USED') {
        req.log.warn({ userId: user.id, paymentId: p.id }, 'duplicate UTR submitted');
      }
      throw err;
    }
    const fresh = await deps.db.payment.findUniqueOrThrow({ where: { id: p.id }, include: { subscription: true } });
    return serializePayment(fresh);
  });
}
