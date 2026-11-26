import type { Db, Prisma } from './db.ts';

export interface AuditActor {
  id: string | null;
  type?: 'admin' | 'system' | 'user';
  ip?: string | null;
  userAgent?: string | null;
}

type Tx = Pick<Db, 'auditLog'> | Prisma.TransactionClient;

// Strip things that must never be copied into the audit trail.
const SECRET_FIELDS = new Set(['passwordHash', 'totpSecretEnc', 'backupCodes', 'refreshTokenHash', 'tokenHash', 'csrfToken']);

function scrub(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(
    JSON.stringify(value, (k, v: unknown) => (SECRET_FIELDS.has(k) ? '[redacted]' : v)),
  ) as Prisma.InputJsonValue;
}

export async function audit(
  db: Tx,
  actor: AuditActor,
  action: string,
  entity: string,
  entityId: string | null,
  before?: unknown,
  after?: unknown,
) {
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      actorType: actor.type ?? 'admin',
      action,
      entity,
      entityId,
      before: scrub(before),
      after: scrub(after),
      ip: actor.ip ?? null,
      userAgent: actor.userAgent?.slice(0, 300) ?? null,
    },
  });
}
