import argon2 from 'argon2';

// argon2id with OWASP's suggested minimums (19 MiB, t=2).
const OPTS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (p: string) => argon2.hash(p, OPTS);
export const verifyPassword = async (hash: string, p: string) => {
  try {
    return await argon2.verify(hash, p);
  } catch {
    return false;
  }
};

// A dummy hash so a login for an unknown email takes as long as a real one.
let dummy: string | null = null;
export async function burnTime(p: string) {
  dummy ??= await hashPassword('not-a-real-password-just-timing');
  await verifyPassword(dummy, p);
}

// Short list of the passwords that show up first in every leak, plus the
// obvious local ones. Not a replacement for a password manager, just a floor.
const COMMON = new Set(
  [
    '123456789012', 'password1234', 'qwertyuiop12', '1234567890ab', 'iloveyou1234', 'admin1234567',
    'welcome12345', 'password@123', 'Password@123', 'P@ssw0rd1234', 'india@123456', 'qwerty123456',
    'abcd12345678', 'letmein12345', 'rentnook1234', 'rentnook@123', 'Rentnook@123', 'admin@123456',
    '111111111111', '000000000000', '123123123123', 'asdfghjkl123', 'zaq12wsxcde3', 'changeme1234',
  ].map((p) => p.toLowerCase()),
);

export function passwordProblem(password: string, email: string): string | null {
  if (password.length < 12) return 'Use at least 12 characters';
  if (password.length > 128) return 'Use at most 128 characters';
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) return 'This password is too common';
  const local = email.split('@')[0]?.toLowerCase() ?? '';
  if (local.length >= 4 && lower.includes(local)) return 'Do not use your email in the password';
  if (/^(.)\1+$/.test(password)) return 'This password is too simple';
  if (new Set(password).size < 6) return 'Use more different characters';
  return null;
}
