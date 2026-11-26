// One-time command that creates the first Super admin (P1-08). There is no
// sign-up page; every other staff account is invited from the admin panel.
//
//   npm run admin:create -- --email owner@company.in --name "Daman Singh"
//
// The password is read from the terminal (not from arguments, so it does not
// end up in shell history).

import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { parseArgs } from 'node:util';
import { loadEnv } from '../config/env.ts';
import { createDb } from '../services/db.ts';
import { hashPassword, passwordProblem } from '../modules/admin/passwords.ts';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
const env = loadEnv();
const db = createDb(env.DATABASE_URL);

const email = values.email?.trim().toLowerCase();
const name = values.name?.trim();
if (!email || !name) {
  console.error('Usage: npm run admin:create -- --email <email> --name "<full name>"');
  process.exit(1);
}

const supers = await db.admin.count({ where: { role: 'SUPER_ADMIN' } });
if (supers > 0) {
  console.error('A Super admin already exists. Invite more staff from the admin panel.');
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout, terminal: true });
const password = process.env.ADMIN_INITIAL_PASSWORD ?? (await rl.question('Password (12+ characters): '));
rl.close();
const problem = passwordProblem(password, email);
if (problem) {
  console.error(problem);
  process.exit(1);
}

const admin = await db.admin.create({ data: { email, name, role: 'SUPER_ADMIN', passwordHash: await hashPassword(password) } });
await db.auditLog.create({ data: { actorId: null, actorType: 'system', action: 'admin.bootstrap', entity: 'Admin', entityId: admin.id, after: { email, role: 'SUPER_ADMIN' } } });
console.log(`Super admin ${email} created. Sign in to the admin panel to set up the authenticator app.`);
await db.$disconnect();
