import type { FastifyInstance } from 'fastify';
import type { Deps } from '../deps.ts';
import { forbidden, notFound } from '../lib/errors.ts';
import { LocalStorage, type BucketKind } from '../services/storage.ts';

// Stand-in for S3 signed URLs during local development. Registered only when
// STORAGE_DRIVER=local, which config refuses on staging and production.
export function registerLocalStorage(app: FastifyInstance, deps: Deps) {
  if (!(deps.storage instanceof LocalStorage)) return;
  const storage = deps.storage;

  app.addContentTypeParser(['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream'], { parseAs: 'buffer', bodyLimit: 6 * 1024 * 1024 }, (_req, body, done) => done(null, body));

  const read = (q: unknown) => {
    const { b, k, exp, sig } = (q ?? {}) as Record<string, string>;
    if ((b !== 'photos' && b !== 'private') || !k || !exp || !sig) throw forbidden();
    return { bucket: b as BucketKind, key: k, exp: Number(exp), sig };
  };

  app.put('/_local-storage/object', { bodyLimit: 6 * 1024 * 1024 }, async (req) => {
    const { bucket, key, exp, sig } = read(req.query);
    if (!storage.verify('PUT', bucket, key, exp, sig)) throw forbidden('Link expired');
    await storage.put(bucket, key, req.body as Buffer);
    return { ok: true };
  });

  app.get('/_local-storage/object', async (req, reply) => {
    const { bucket, key, exp, sig } = read(req.query);
    if (!storage.verify('GET', bucket, key, exp, sig)) throw forbidden('Link expired');
    const data = await storage.get(bucket, key);
    if (!data) throw notFound();
    const type = key.endsWith('.webp') ? 'image/webp' : key.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream';
    return reply.header('Content-Type', type).header('Cache-Control', 'private, max-age=600').send(data);
  });
}
