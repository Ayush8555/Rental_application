import { getMessaging } from 'firebase-admin/messaging';
import type { FastifyBaseLogger } from 'fastify';
import type { Env } from '../config/env.ts';
import { firebaseApp } from './firebase.ts';

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface Push {
  // Returns tokens that FCM says are dead so the caller can delete them.
  send(tokens: string[], msg: PushMessage): Promise<{ sent: number; deadTokens: string[] }>;
}

class FcmPush implements Push {
  constructor(private env: Env) {}
  async send(tokens: string[], msg: PushMessage) {
    if (!tokens.length) return { sent: 0, deadTokens: [] };
    const res = await getMessaging(firebaseApp(this.env)).sendEachForMulticast({
      tokens,
      notification: { title: msg.title, body: msg.body },
      data: msg.data,
      android: { priority: 'high', notification: { channelId: 'general' } },
    });
    const deadTokens: string[] = [];
    res.responses.forEach((r, i) => {
      const code = r.error?.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
        deadTokens.push(tokens[i]!);
      }
    });
    return { sent: res.successCount, deadTokens };
  }
}

// Logs only the count and title. Bodies can carry names, so they stay out of logs.
class LogPush implements Push {
  public outbox: Array<{ tokens: string[]; msg: PushMessage }> = [];
  constructor(private log?: FastifyBaseLogger) {}
  async send(tokens: string[], msg: PushMessage) {
    this.outbox.push({ tokens, msg });
    if (this.outbox.length > 500) this.outbox.shift();
    this.log?.debug({ devices: tokens.length, title: msg.title }, 'push (log driver)');
    return { sent: tokens.length, deadTokens: [] };
  }
}

export function createPush(env: Env, log?: FastifyBaseLogger): Push {
  return env.PUSH_PROVIDER === 'fcm' ? new FcmPush(env) : new LogPush(log);
}
export { LogPush };
