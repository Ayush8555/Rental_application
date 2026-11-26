import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Env } from '../config/env.ts';
import { hmac, safeEqual } from '../lib/crypto.ts';

export type BucketKind = 'photos' | 'private';

export interface SignedPut {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

export interface Storage {
  signPut(bucket: BucketKind, key: string, contentType: string, expiresSec: number, sizeBytes?: number): Promise<SignedPut>;
  signGet(bucket: BucketKind, key: string, expiresSec: number): Promise<string>;
  get(bucket: BucketKind, key: string): Promise<Buffer | null>;
  put(bucket: BucketKind, key: string, body: Buffer, contentType: string): Promise<void>;
  remove(bucket: BucketKind, key: string): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{0,200}$/i;

function assertKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes('..')) throw new Error('unsafe storage key');
}

// ---------------------------------------------------------------- S3 / any S3-compatible store

export class S3Storage implements Storage {
  private s3: S3Client;
  constructor(private env: Env) {
    this.s3 = new S3Client({
      region: env.STORAGE_REGION,
      endpoint: env.STORAGE_ENDPOINT,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
      credentials:
        env.STORAGE_KEY && env.STORAGE_SECRET
          ? { accessKeyId: env.STORAGE_KEY, secretAccessKey: env.STORAGE_SECRET }
          : undefined,
    });
  }

  private bucket(kind: BucketKind) {
    return kind === 'photos' ? this.env.BUCKET_PHOTOS : this.env.BUCKET_PRIVATE_DOCS;
  }

  async signPut(kind: BucketKind, key: string, contentType: string, expiresSec: number, sizeBytes?: number): Promise<SignedPut> {
    assertKey(key);
    // Content-Length is part of the signature, so the client cannot upload
    // a bigger file than the size it declared.
    const cmd = new PutObjectCommand({ Bucket: this.bucket(kind), Key: key, ContentType: contentType, ContentLength: sizeBytes });
    const url = await getSignedUrl(this.s3, cmd, { expiresIn: expiresSec });
    return {
      url,
      method: 'PUT',
      headers: { 'Content-Type': contentType, ...(sizeBytes ? { 'Content-Length': String(sizeBytes) } : {}) },
      expiresAt: new Date(Date.now() + expiresSec * 1000).toISOString(),
    };
  }

  async signGet(kind: BucketKind, key: string, expiresSec: number) {
    assertKey(key);
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket(kind), Key: key }), { expiresIn: expiresSec });
  }

  async get(kind: BucketKind, key: string) {
    assertKey(key);
    try {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket(kind), Key: key }));
      if (!res.Body) return null;
      return Buffer.from(await res.Body.transformToByteArray());
    } catch (err) {
      if ((err as { name?: string }).name === 'NoSuchKey') return null;
      throw err;
    }
  }

  async put(kind: BucketKind, key: string, body: Buffer, contentType: string) {
    assertKey(key);
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket(kind), Key: key, Body: body, ContentType: contentType }));
  }

  async remove(kind: BucketKind, key: string) {
    assertKey(key);
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket(kind), Key: key }));
  }
}

// ---------------------------------------------------------------- local disk (development only)
// Mimics signed URLs with an HMAC so the app code path is the same as with S3.
// Served by routes in plugins/local-storage.ts, which are only registered
// when STORAGE_DRIVER=local (refused by config outside dev/test).

export class LocalStorage implements Storage {
  private root: string;
  constructor(private env: Env) {
    this.root = resolve(env.STORAGE_LOCAL_DIR);
  }

  private path(kind: BucketKind, key: string) {
    assertKey(key);
    const p = normalize(join(this.root, kind, key));
    if (!p.startsWith(join(this.root, kind))) throw new Error('unsafe storage key');
    return p;
  }

  sign(method: 'GET' | 'PUT', kind: BucketKind, key: string, exp: number) {
    return hmac(this.env.URL_SIGNING_SECRET, `${method}\n${kind}\n${key}\n${exp}`);
  }

  verify(method: 'GET' | 'PUT', kind: BucketKind, key: string, exp: number, sig: string) {
    if (!Number.isFinite(exp) || exp < Date.now() / 1000) return false;
    return safeEqual(this.sign(method, kind, key, exp), sig);
  }

  private url(method: 'GET' | 'PUT', kind: BucketKind, key: string, expiresSec: number) {
    const exp = Math.floor(Date.now() / 1000) + expiresSec;
    const q = new URLSearchParams({ b: kind, k: key, exp: String(exp), sig: this.sign(method, kind, key, exp) });
    return `${this.env.APP_BASE_URL}/_local-storage/object?${q}`;
  }

  async signPut(kind: BucketKind, key: string, contentType: string, expiresSec: number): Promise<SignedPut> {
    return {
      url: this.url('PUT', kind, key, expiresSec),
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(Date.now() + expiresSec * 1000).toISOString(),
    };
  }

  async signGet(kind: BucketKind, key: string, expiresSec: number) {
    return this.url('GET', kind, key, expiresSec);
  }

  async get(kind: BucketKind, key: string) {
    try {
      return await readFile(this.path(kind, key));
    } catch {
      return null;
    }
  }

  async put(kind: BucketKind, key: string, body: Buffer) {
    const p = this.path(kind, key);
    await mkdir(dirname(p), { recursive: true });
    await writeFile(p, body, { mode: 0o600 });
  }

  async remove(kind: BucketKind, key: string) {
    await rm(this.path(kind, key), { force: true });
  }
}

export function createStorage(env: Env): Storage {
  return env.STORAGE_DRIVER === 's3' ? new S3Storage(env) : new LocalStorage(env);
}
