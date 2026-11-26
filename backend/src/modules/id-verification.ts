import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { currentUser, requireUser } from '../plugins/auth.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { conflict } from '../lib/errors.ts';
import { parse } from '../lib/validate.ts';
import { claimUploads } from './uploads.ts';

// The ID photo goes to the private-docs bucket, is seen only by Super admins
// (every view audit-logged) and is deleted 30 days after the decision.
// The ID number itself is never typed in or stored.
export default async function idVerificationRoutes(app: FastifyInstance, deps: Deps) {
  app.get('/id-verifications/mine', { preHandler: requireUser }, async (req) => {
    const latest = await deps.db.idVerification.findFirst({ where: { userId: currentUser(req).id }, orderBy: { createdAt: 'desc' } });
    return {
      verified: currentUser(req).idVerified,
      latest: latest ? { status: latest.status, rejectReason: latest.rejectReason, createdAt: latest.createdAt, decidedAt: latest.decidedAt } : null,
    };
  });

  app.post('/id-verifications', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'id-verify', user.id, 3, 24 * 3600, 'You can try ID verification 3 times a day.');
    const { uploadId } = parse(z.object({ uploadId: z.uuid() }).strict(), req.body);
    if (user.idVerified) throw conflict('You are already verified', 'ALREADY_VERIFIED');
    const pending = await deps.db.idVerification.findFirst({ where: { userId: user.id, status: 'PENDING' } });
    if (pending) throw conflict('Your ID is already being checked', 'ALREADY_PENDING');
    const [u] = await claimUploads(deps, user.id, [uploadId], 'id');
    const row = await deps.db.$transaction(async (tx) => {
      await tx.upload.update({ where: { id: u!.id }, data: { status: 'ATTACHED' } });
      return tx.idVerification.create({ data: { userId: user.id, docKey: u!.finalKey! } });
    });
    return { id: row.id, status: row.status };
  });
}
