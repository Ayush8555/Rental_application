# RentNook

People in Indian cities put things they don't use on rent — cameras, drills,
sofas, party lights — and others nearby find them and talk to the owner on
WhatsApp. Seekers use it free; listers buy a plan, paid by UPI and checked
by hand against the bank statement.

This repo has everything: the API, the admin panel, the Android app and the
server setup. The plan we're building against is in `docs/BUILD_PLAN.md`;
where each phase stands is in `docs/PROGRESS.md`.

```
backend/   Node 22 + Fastify + Prisma (Postgres) + Redis/BullMQ. Also serves the
           public pages: privacy, terms, delete account, shared item links.
admin/     React + Vite admin panel (staff only, 2-step login)
app/       Flutter app, Android first
infra/     docker-compose, Caddy (HTTPS), Postgres roles, backup/deploy scripts
docs/      plan, progress, decisions, security review, handover notes
```

## Running it locally

You need Node 22, PostgreSQL 16, Redis 7 and (for the app) Flutter 3.50.

```bash
# database user for local work
sudo -u postgres psql -c "CREATE ROLE rentnook LOGIN PASSWORD 'localdev' CREATEDB;"
sudo -u postgres createdb -O rentnook rentnook_dev
sudo -u postgres psql -d rentnook_dev -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

```bash
cd backend
cp .env.example .env        # then put random values in the secret lines
npm install
npx prisma migrate deploy
npm run db:seed             # 5 cities, 40 listings, 4 plans — never on production
npm run dev                 # http://localhost:4000
```

```bash
npm run admin:create -- --email you@example.com --name "Your Name"   # first Super admin
cd ../admin && npm install && npm run dev                              # http://localhost:5173
```

```bash
cd app && flutter pub get
flutter run --flavor dev --dart-define=API_URL=http://10.0.2.2:4000
```

Locally there's no Firebase, so login runs in dev mode: the app accepts any
10-digit number and any 6-digit code, and the API accepts tokens like
`dev:+919000000010` (that number is one of the seeded listers). Photos are
written to `backend/.data/storage` instead of S3, and push messages go to the
log. The API refuses to start with any of these dev shortcuts when
`NODE_ENV` is `staging` or `production`.

## Tests

```bash
cd backend && npm test          # needs Postgres + Redis; uses rentnook_test
cd admin && npm run lint && npm run build
cd app && flutter analyze && flutter test
```

The backend tests hit a real database and cover the attack list from section
22 of the plan (another user's listing, admin routes with a user token, UTR
reuse, parallel approvals, coupon races, upload tricks and so on). CI runs
all of the above plus Gitleaks and Semgrep on every pull request.

## What is a stand-in right now

These work locally with dummy values. Each needs the real thing before
staging, and none of them needs a code change — only config.

| Needs | Used for | Locally | For staging/production |
|---|---|---|---|
| PostgreSQL 16 | all data | local Postgres | managed Postgres or the `postgres` service in `infra/docker-compose.yml`, on a server in India |
| Redis 7 | rate limits, jobs, sessions cache | local Redis | `redis` service in compose (password set) |
| Linux server ×2 | API, worker, admin, public pages | your laptop | staging + production, setup in `infra/scripts/server-setup.md` |
| Domain + DNS | `api.`, `admin.`, `www.` (+ `staging-*`) | localhost | set `API_HOST`, `ADMIN_HOST`, `WWW_HOST` in `infra/.env`; Caddy gets HTTPS itself |
| Object storage (S3-compatible) | listing photos, payment screenshots, ID photos | `STORAGE_DRIVER=local` | `STORAGE_DRIVER=s3` + keys; buckets `photos-*` and `private-docs-*`, both private |
| Firebase (2 projects) | phone OTP, App Check, push | `AUTH_PROVIDER=dev`, `PUSH_PROVIDER=log` | `firebase` / `fcm`, service account JSON on the server, `--dart-define` values in the app build |
| Cloudflare Turnstile | captcha on admin login after 3 wrong tries | off | `CAPTCHA_PROVIDER=turnstile` + keys |
| Company UPI ID | where plan payments go | `rentnook@okaxis` placeholder | Admin → Settings → UPI (Super admin) |
| Support / grievance details | app Help screen, Privacy Policy | placeholders | Admin → Settings |
| Sentry | error tracking | off | `SENTRY_DSN_BACKEND` |
| Off-site backup storage + `age` key | nightly encrypted DB backups | – | `infra/scripts/backup.sh` |
| Android upload keystore | signing the Play release | debug key | `app/android/key.properties` (git-ignored) |

The full list of environment variables, with comments, is in
`backend/.env.example`.

## Things that matter when changing code

- Amounts are integer paise and are always worked out on the server. The app
  never sends a price.
- Phone numbers don't leave the server except in the WhatsApp link after
  someone taps Chat, and masked (`98XXXXXX10`) on the person's own profile.
- Every admin write goes to the audit log, which can't be edited even from
  the database role the API uses.
- Text from users is shown as plain text in the admin panel. Lint fails on
  `dangerouslySetInnerHTML`.
- Screens use the tokens in `app/lib/theme/tokens.dart` and
  `admin/src/styles.css`, nothing hard-coded.

More in `CLAUDE.md` (repo rules) and `docs/DECISIONS.md`.

## Deploying

`infra/scripts/deploy.sh` builds the images, runs migrations as the owner
role, tightens grants and restarts. Merges to `main` deploy to staging from
GitHub Actions; production is deployed by hand from a tag. Day-to-day
operations (backups, rollback, changing the UPI ID, releasing an app update)
are in `docs/HANDOVER.md`.
