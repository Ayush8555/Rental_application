import { execSync } from 'node:child_process';

export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://rentnook:localdev@localhost:5432/rentnook_test';
  execSync('npx prisma migrate deploy', { env: { ...process.env, DATABASE_URL: url, MIGRATION_DATABASE_URL: url }, stdio: 'ignore' });
}
