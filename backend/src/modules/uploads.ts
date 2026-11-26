import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { currentUser, requireUser } from '../plugins/auth.ts';
import { enforceLimit } from '../plugins/limits.ts';
import { badRequest, notFound } from '../lib/errors.ts';
import { parse } from '../lib/validate.ts';
import { MAX_UPLOAD_BYTES, processImage, type ImageReject } from '../services/images.ts';
import type { UploadPurpose } from '../services/db.ts';
import type { BucketKind } from '../services/storage.ts';

const SIGN_TTL_SEC = 10 * 60;

// How each kind of upload is stored and how big the re-encoded copy may be.
export const PURPOSES: Record<UploadPurpose, { bucket: BucketKind; maxSide: number; maxBytes: number; prefix: string }> = {
  listing: { bucket: 'photos', maxSide: 1600, maxBytes: MAX_UPLOAD_BYTES, prefix: 'listing' },
  logo: { bucket: 'photos', maxSide: 512, maxBytes: 2 * 1024 * 1024, prefix: 'logo' },
  proof: { bucket: 'private', maxSide: 2000, maxBytes: MAX_UPLOAD_BYTES, prefix: 'proof' },
  id: { bucket: 'private', maxSide: 2000, maxBytes: MAX_UPLOAD_BYTES, prefix: 'id' },
};

const signBody = z
  .object({
    purpose: z.enum(['listing', 'proof', 'id', 'logo']),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    sizeBytes: z.number().int().min(100).max(MAX_UPLOAD_BYTES),
  })
  .strict();

const REJECT_TEXT: Record<ImageReject, string> = {
  TOO_LARGE: 'This photo is too large. Please use one under 5 MB.',
  NOT_AN_IMAGE: 'Only JPG, PNG or WebP photos can be uploaded.',
  BAD_TYPE: 'Only JPG, PNG or WebP photos can be uploaded.',
  TOO_MANY_PIXELS: 'This photo is too big in size. Please use a normal camera photo.',
  BROKEN: 'We could not read this photo. Please try another one.',
};

export default async function uploadRoutes(app: FastifyInstance, deps: Deps) {
  app.post('/uploads/sign', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'upload-sign', user.id, 80, 3600, 'Too many uploads. Please wait a while.');
    const body = parse(signBody, req.body);
    const cfg = PURPOSES[body.purpose];
    if (body.sizeBytes > cfg.maxBytes) throw badRequest(REJECT_TEXT.TOO_LARGE, 'TOO_LARGE');

    // Random key; the original file name is never used.
    const rawKey = `raw/${body.purpose}/${randomUUID()}`;
    const upload = await deps.db.upload.create({
      data: {
        userId: user.id,
        purpose: body.purpose,
        rawKey,
        expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
      },
    });
    const signed = await deps.storage.signPut('private', rawKey, body.contentType, SIGN_TTL_SEC, body.sizeBytes);
    return { uploadId: upload.id, ...signed };
  });

  // Called by the app after the PUT finishes. Validates and re-encodes.
  app.post('/uploads/:id/complete', { preHandler: requireUser }, async (req) => {
    const user = currentUser(req);
    await enforceLimit(deps, 'upload-complete', user.id, 80, 3600);
    const { id } = parse(z.object({ id: z.uuid() }).strict(), req.params);
    const upload = await deps.db.upload.findFirst({ where: { id, userId: user.id } });
    if (!upload) throw notFound('Upload not found');
    if (upload.status === 'READY' || upload.status === 'ATTACHED') {
      return { id: upload.id, status: 'READY', width: upload.width, height: upload.height };
    }
    if (upload.status === 'REJECTED') throw badRequest(REJECT_TEXT[upload.rejectCode as ImageReject] ?? REJECT_TEXT.BROKEN, upload.rejectCode ?? 'REJECTED');

    const cfg = PURPOSES[upload.purpose];
    const raw = await deps.storage.get('private', upload.rawKey);
    if (!raw) throw badRequest('The photo did not finish uploading. Please try again.', 'NOT_UPLOADED');

    const result = await processImage(raw, { maxSide: cfg.maxSide, maxBytes: cfg.maxBytes });
    await deps.storage.remove('private', upload.rawKey).catch(() => undefined);

    if ('reject' in result) {
      await deps.db.upload.update({ where: { id }, data: { status: 'REJECTED', rejectCode: result.reject } });
      throw badRequest(REJECT_TEXT[result.reject], result.reject);
    }

    const finalKey = `${cfg.prefix}/${randomUUID()}.webp`;
    await deps.storage.put(cfg.bucket, finalKey, result.data, 'image/webp');
    await deps.db.upload.update({
      where: { id },
      data: { status: 'READY', finalKey, width: result.width, height: result.height, hash: result.hash, dhash: result.dhash },
    });
    return { id, status: 'READY', width: result.width, height: result.height };
  });
}

// Claims READY uploads of the given purpose for this user. Throws if any id
// is unknown, foreign, not processed or already used.
export async function claimUploads(deps: Deps, userId: string, ids: string[], purpose: UploadPurpose) {
  if (!ids.length) return [];
  if (new Set(ids).size !== ids.length) throw badRequest('The same photo was added twice', 'DUPLICATE_UPLOAD');
  const rows = await deps.db.upload.findMany({ where: { id: { in: ids }, userId, purpose } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => {
    const r = byId.get(id);
    if (!r || !r.finalKey || (r.status !== 'READY' && r.status !== 'ATTACHED')) {
      throw badRequest('One of the photos is not ready yet. Please wait or upload it again.', 'UPLOAD_NOT_READY');
    }
    return r;
  });
}
