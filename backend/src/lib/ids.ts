import { randomBytes, randomInt } from 'node:crypto';

// Crockford-ish alphabet without look-alikes (0/O, 1/I/L).
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function shortCode(length: number): string {
  let out = '';
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

// Share link ids: 10 chars from 31 symbols ≈ 49 bits, not guessable by walking.
export const newShortId = () => shortCode(10);
export const newPaymentRef = () => `RN-${shortCode(6)}`;
export const newReferralCode = () => shortCode(7);

export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
