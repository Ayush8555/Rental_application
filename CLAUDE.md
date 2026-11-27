# RentNook – rules for every task
Read docs/BUILD_PLAN.md (the phase you are in) and docs/PROGRESS.md before any work.

## Scope
- Build ONLY what the current phase card says. No extra features, screens or packages.
- If something is unclear, write the question in docs/PROGRESS.md and stop.

## Stack
Backend: Node LTS, TypeScript strict, Fastify, Prisma, PostgreSQL, Redis, BullMQ, Zod.
Admin: React + TypeScript + Vite + TanStack Query. App: Flutter (Riverpod, Dio, go_router).

## Security rules (never break)
1. Validate body, params, query and headers with Zod. Reject unknown fields (strict).
2. Every route that reads or changes a record checks ownership or role on the server.
   Write a test proving user A cannot read or change user B's data.
3. Responses use explicit output schemas (allow-list). Never return phone numbers,
   exact location, tokens, hashes or internal flags unless the card says so.
4. Database access only through Prisma. No string-built SQL.
5. No secrets in code, logs, tests, screenshots or the Flutter app. Use env vars;
   add new keys to .env.example with a dummy value.
6. Money is integer paise. Amounts are always computed on the server.
7. Every admin action writes an AuditLog row (who, what, before, after, ip).
8. Errors to clients: {error:{code,message}} only. No stack traces or SQL errors.
9. Every list endpoint is paginated (max 50) and every write endpoint is rate limited.
10. Use database transactions + unique constraints for money, plans, coupons, approvals.
11. Never log OTPs, tokens, full phone numbers (mask: 98XXXXXX10) or ID documents.
12. Do not add or upgrade a dependency without explaining why in the pull request.

## UI rules
Follow docs/BUILD_PLAN.md sections 8-10 (design system and human-feel rules).
Use only design tokens; no hard-coded colours, sizes or fonts in screens.

## Workflow
1. Plan: list files to change, data changes, endpoints, screens, tests. Wait for OK.
2. Build in small commits. 3. Run: lint, typecheck, tests, npm audit, gitleaks.
4. Run the security review (7.4) and UI review (7.5) on what changed.
5. Fix everything found, then re-run ALL checks. Repeat until clean.
6. Update docs/PROGRESS.md: done, how tested, open issues.
