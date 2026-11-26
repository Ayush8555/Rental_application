import sharp from 'sharp';
import { sha256 } from '../lib/crypto.ts';

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const MAX_PIXELS_SIDE = 8000;

export type ImageReject = 'TOO_LARGE' | 'NOT_AN_IMAGE' | 'BAD_TYPE' | 'TOO_MANY_PIXELS' | 'BROKEN';

export interface ProcessedImage {
  data: Buffer;
  width: number;
  height: number;
  hash: string;
  dhash: string;
}

// Decide the type from the first bytes, never from the file name or the
// Content-Type the client claimed.
export function sniff(buf: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

// Re-encoding throws away EXIF (including GPS), ICC tricks, trailing data and
// anything hidden after the image. limitInputPixels stops decompression bombs
// before sharp allocates memory for them.
export async function processImage(
  input: Buffer,
  opts: { maxSide: number; quality?: number; maxBytes?: number },
): Promise<ProcessedImage | { reject: ImageReject }> {
  if (input.length > (opts.maxBytes ?? MAX_UPLOAD_BYTES)) return { reject: 'TOO_LARGE' };
  const kind = sniff(input);
  if (!kind) return { reject: 'NOT_AN_IMAGE' };

  try {
    const img = sharp(input, { limitInputPixels: MAX_PIXELS_SIDE * MAX_PIXELS_SIDE, failOn: 'error' });
    const meta = await img.metadata();
    if (!meta.width || !meta.height) return { reject: 'BROKEN' };
    if (meta.format !== kind && !(kind === 'jpeg' && meta.format === 'jpeg')) return { reject: 'BAD_TYPE' };
    if (meta.width > MAX_PIXELS_SIDE || meta.height > MAX_PIXELS_SIDE) return { reject: 'TOO_MANY_PIXELS' };

    const out = await img
      .rotate() // apply EXIF orientation before the EXIF is dropped
      .resize({ width: opts.maxSide, height: opts.maxSide, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: opts.quality ?? 80 })
      .toBuffer({ resolveWithObject: true });

    return {
      data: out.data,
      width: out.info.width,
      height: out.info.height,
      hash: sha256(out.data),
      dhash: await dhash(out.data),
    };
  } catch {
    return { reject: 'BROKEN' };
  }
}

// 64-bit difference hash. Two photos of the same item from the same phone
// end up within a few bits of each other even after resizing.
export async function dhash(buf: Buffer): Promise<string> {
  const px = await sharp(buf).greyscale().resize(9, 8, { fit: 'fill' }).raw().toBuffer();
  let bits = '';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits += px[y * 9 + x]! > px[y * 9 + x + 1]! ? '1' : '0';
    }
  }
  return BigInt(`0b${bits}`).toString(16).padStart(16, '0');
}

export function hammingHex(a: string, b: string): number {
  let x = BigInt(`0x${a}`) ^ BigInt(`0x${b}`);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}
