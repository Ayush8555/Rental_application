import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import type { Env } from '../config/env.ts';

let app: App | null = null;

// Lazily created; only used when AUTH_PROVIDER=firebase or PUSH_PROVIDER=fcm.
export function firebaseApp(env: Env): App {
  if (app) return app;
  if (getApps().length) return (app = getApp());
  const json = env.FIREBASE_SERVICE_ACCOUNT_JSON;
  app = initializeApp({
    projectId: env.FIREBASE_PROJECT_ID,
    credential: json ? cert(JSON.parse(json) as Record<string, string>) : undefined,
  });
  return app;
}
