import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.ts';

export type Db = PrismaClient;

export function createDb(url: string): Db {
  const adapter = new PrismaPg({ connectionString: url, statement_timeout: 10_000, max: 20 });
  return new PrismaClient({ adapter });
}

export { Prisma } from '../generated/prisma/client.ts';
export type * from '../generated/prisma/client.ts';
