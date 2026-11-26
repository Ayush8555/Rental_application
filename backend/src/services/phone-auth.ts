import { getAuth } from 'firebase-admin/auth';
import { getAppCheck } from 'firebase-admin/app-check';
import type { Env } from '../config/env.ts';
import { isIndianMobile } from '../lib/phone.ts';
import { firebaseApp } from './firebase.ts';

export interface VerifiedPhone {
  uid: string;
  phone: string;
}

export interface PhoneAuth {
  // Returns null for any token that is not valid; never throws on bad input.
  verifyIdToken(idToken: string): Promise<VerifiedPhone | null>;
}

export interface AppCheck {
  verify(token: string | undefined): Promise<boolean>;
}

class FirebasePhoneAuth implements PhoneAuth {
  constructor(private env: Env) {}
  async verifyIdToken(idToken: string) {
    try {
      // checkRevoked=true: a user disabled in Firebase cannot keep logging in.
      const decoded = await getAuth(firebaseApp(this.env)).verifyIdToken(idToken, true);
      if (decoded.aud !== this.env.FIREBASE_PROJECT_ID) return null;
      const phone = decoded.phone_number;
      if (!phone || decoded.firebase?.sign_in_provider !== 'phone') return null;
      return { uid: decoded.uid, phone };
    } catch {
      return null;
    }
  }
}

class FirebaseAppCheck implements AppCheck {
  constructor(private env: Env) {}
  async verify(token: string | undefined) {
    if (!token || token.length > 4096) return false;
    try {
      const res = await getAppCheck(firebaseApp(this.env)).verifyToken(token);
      return res.appId.length > 0;
    } catch {
      return false;
    }
  }
}

// Development stand-ins. Config validation refuses AUTH_PROVIDER=dev on
// staging and production, so these can never run against real users.
// Token format: "dev:+919812345678".
class DevPhoneAuth implements PhoneAuth {
  async verifyIdToken(idToken: string) {
    const m = /^dev:(\+\d{8,15})$/.exec(idToken);
    if (!m?.[1]) return null;
    return { uid: `dev-${m[1]}`, phone: m[1] };
  }
}

class DevAppCheck implements AppCheck {
  async verify(token: string | undefined) {
    return token === 'dev-app-check';
  }
}

export function createPhoneAuth(env: Env): PhoneAuth {
  return env.AUTH_PROVIDER === 'firebase' ? new FirebasePhoneAuth(env) : new DevPhoneAuth();
}

export function createAppCheck(env: Env): AppCheck {
  return env.AUTH_PROVIDER === 'firebase' ? new FirebaseAppCheck(env) : new DevAppCheck();
}

export { isIndianMobile };
