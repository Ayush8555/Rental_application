# Progress

Status per phase. "Done here" = built and checked in code. "Needs you" = needs
a real account, device, server or a person, so it cannot be ticked from the
repo alone.

Last update: 27 Nov 2026.

## Phase 0 — Setup

Done here
- Repo layout from section 5; CLAUDE.md, BUILD_PLAN.md, PROGRESS.md, DECISIONS.md, SECURITY_REVIEW.md.
- Backend skeleton (P0-10): Fastify, TypeScript strict, Prisma, Zod, pino with redaction, health
  endpoint, error handler, helmet headers, Redis rate limit, CORS only for the admin origin.
- Admin skeleton and design tokens (P0-11, P0-14).
- Flutter app (P0-12): package `in.rentnook.app`, flavors dev/staging/prod, tokens, fonts bundled
  (Sora, Noto Sans, Noto Sans Devanagari, Phosphor icons), Riverpod + go_router + Dio, no cleartext,
  release config from section 16. Component gallery at `/gallery` in debug builds.
- CI (P0-13): lint, typecheck, tests, npm audit, flutter analyze/test, Gitleaks, Semgrep.
- Seed data (P0-15): 5 cities, 12 areas, 6 categories, 40 listings, 4 plans, 8 listers.
- Infra: docker-compose, Caddy (HTTPS, headers), Postgres roles, backup/restore/deploy scripts.

Needs you
- P0-01/02 company accounts, D-U-N-S, Play Console. P0-03/04 Firebase projects and key restrictions.
- P0-05/06/07 domain, servers in India, buckets. P0-08 branch protection and secret scanning on GitHub.
- P0-16 Sentry projects and uptime monitor (backend already reads `SENTRY_DSN_BACKEND`).
- Gate: port scan, header scanner on staging, Flutter build on a real phone.

## Phase 1 — Foundation

Done here
- Schema v1, auth middleware, login/refresh/logout with rotation and reuse detection (P1-01..03).
- Rate limits: /auth 10/min per IP, 5/min per device, global 100/min (P1-04).
- Profile, consent log, cities + waitlist, categories (P1-05..07).
- Admin auth: Argon2, TOTP, backup codes, CSRF + Origin check, lockout, idle timeout, roles,
  first Super admin by CLI, invites by link (P1-08). Audit log + viewer (P1-09).
- App A-01..A-07, admin W-01..W-05, public P-01.
- Tests: token expiry/signature/alg none, blocked user (T17), refresh reuse (T16), same response
  for new and existing numbers (T22), admin routes with user token (T2), lockout, CSRF (T14).

Needs you
- Real OTP on a real Indian number; foreign number refused by Firebase SMS region policy.
- UI review on real phones; Daman Singh to review draft Privacy/Terms.

## Phase 2 — Listings, search, WhatsApp

Done here
- Listings, images, favourites, blocks, reports, search log, full-text + trigram index.
- Upload pipeline: signed URL → magic-byte check → 8,000 px and 5 MB caps → WebP re-encode
  (EXIF/GPS gone) → random names.
- Search with filters, sort, cursor (max 50), closed-city items never shown, no phone in output.
- WhatsApp contact: logged in, App Check, not blocked, LIVE, 30 owners/day.
- 3 reports auto-hide. Share page `/i/<shortId>` and assetlinks.json.
- Tests: T1, T3, T9, T10, T11, T12, T13 (source side), T18, T21.

Needs you
- 8 photos on slow 3G, search speed with 5,000 items on staging, exiftool check on staging files,
  WhatsApp on 3 phones, first human check (section 10).

## Phase 3 — Plans, payments, notifications, admin

Done here
- Plan builder with every 12.1 field and live preview; snapshot on purchase; stacking and upgrade;
  expiry job with 7/3/1 reminders, idempotent; city closed pauses days.
- Free/trial plans with per-user and per-device limits, optional approval queue.
- UPI: server-built `upi://pay` link and QR, 12-digit UTR, unique across all payments forever,
  3 pending max, 10 submissions/day, screenshot in private storage (10-min links, 180-day delete).
- Approval in one transaction with row lock + idempotency key; coupon re-checked inside the lock.
- Boosts with city cap and queue; notifications (push + in-app) in English and Hindi; broadcasts.
- Admin W-08..W-13; app A-16..A-23.
- Tests: T4, T5, T6 (4 parallel approvals → 1 subscription), T7 (5 parallel → 2 coupon uses), T8.

Needs you
- ₹1 real UPI loop on staging with a real push. ZAP baseline on staging admin. Daman Singh approves the look.

## Phase 4 — Play Store ready

Done here
- Account deletion in app (OTP re-check) and on the web, job removes photos and anonymises (P4-01/02).
- Legal pages with grievance officer, retention table, refund rules (P4-03 draft).
- Permissions: INTERNET, notifications, coarse location only (P4-05).
- Release config: targetSdk 36, minSdk 24, R8, debuggable off, no backup, no cleartext,
  App Links only, FLAG_SECURE on the UTR screen (P4-06). App Check in release (P4-08 code side).

Needs you
- Upload keystore and Play App Signing (P4-07), production environment (P4-09), store listing and
  content forms (P4-10/11), pre-launch report, closed track with 20+ testers (P4-12..14), MobSF scan,
  G1–G12 checklist.

## Phase 5 — Launch features

Done here
- Free trial, coupons, referral with device checks and monthly cap, share card image,
  request an item, near me, ID verification (Super admin only, 30-day delete), shop page,
  boost credits, Hindi everywhere, insights + CSV, auto-moderation flags.
- Tests: T7, T8, referral farming on one phone, ADMIN cannot see IDs, 30-day delete (time-shifted).

Needs you
- Native Hindi speaker review of `app/lib/l10n/app_hi.arb` and the Hindi help text.
- Release each card to closed testing.

## Phase 6/7

Not started: external security test, k6 load test, restore drill, staged rollout. Scripts for
backup/restore/deploy are ready in `infra/scripts/`.

## Checks run on 27 Nov 2026

| Check | Result |
|---|---|
| Backend tests (Vitest + Supertest, real Postgres + Redis) | 120 passed, 85% lines |
| Backend lint + typecheck | clean |
| Admin lint + typecheck + build | clean |
| Flutter analyze + tests | clean, 8 passed |
| Gitleaks on git history | no leaks |
| API Docker image | builds and serves /health |
| Caddyfile | valid (staging and production variants) |
| Semgrep | runs in GitHub CI (semgrep.dev was not reachable from the build machine) |
