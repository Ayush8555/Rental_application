import type { Env } from '../config/env.ts';

export interface Captcha {
  enabled: boolean;
  siteKey?: string;
  verify(token: string | undefined, ip: string): Promise<boolean>;
}

// Cloudflare Turnstile. Free, no tracking cookies, works without Google.
class Turnstile implements Captcha {
  enabled = true;
  siteKey: string | undefined;
  constructor(private secret: string, siteKey?: string) {
    this.siteKey = siteKey;
  }
  async verify(token: string | undefined, ip: string) {
    if (!token || token.length > 2048) return false;
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: new URLSearchParams({ secret: this.secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(5000),
    }).catch(() => null);
    if (!res?.ok) return false;
    const body = (await res.json()) as { success?: boolean };
    return body.success === true;
  }
}

class NoCaptcha implements Captcha {
  enabled = false;
  async verify() {
    return true;
  }
}

export function createCaptcha(env: Env): Captcha {
  if (env.CAPTCHA_PROVIDER === 'turnstile' && env.TURNSTILE_SECRET) {
    return new Turnstile(env.TURNSTILE_SECRET, env.TURNSTILE_SITE_KEY);
  }
  return new NoCaptcha();
}
