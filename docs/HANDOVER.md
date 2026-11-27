# Handover notes

For Daman Singh's team. Everything below assumes the servers were set up with
`infra/scripts/server-setup.md`.

## Deploy
- Staging: merge to `main`; GitHub Actions runs `infra/scripts/deploy.sh` on the staging server.
- Production: on the server, `git fetch --tags && git checkout v1.2.0 && ./infra/scripts/deploy.sh`.

## Roll back
`git checkout <previous tag> && ./infra/scripts/deploy.sh`. Migrations only add columns and
tables, so the previous version runs on the newer schema. If a migration must be undone, restore
the backup taken just before the deploy.

## Backups
- Nightly at 02:30 IST by `infra/scripts/backup.sh` (encrypted with `age`, copied off-site).
- Monthly restore drill: `infra/scripts/restore.sh <file>` into `rentnook_restore_check`, point a
  staging API at it, open the app.

## First Super admin
```bash
docker compose exec -it api node dist/cli/create-super-admin.js --email owner@company.in --name "Daman Singh"
```
Every other staff account: Admin → Staff → Invite (link valid 24 h).

## Change the UPI ID
Admin → Settings → UPI. Needs a Super admin and a fresh authenticator code. The change is in the
audit log. Pending payments keep the amount they were created with.

## Release an app update
1. Bump `version:` in `app/pubspec.yaml` (build number always goes up).
2. Build the AAB (see `app/README.md`), upload to the internal track, then closed, then production
   at 20% → 50% → 100%.
3. To force old versions to update, raise Settings → App version → Minimum version.

## Certificates
Caddy renews HTTPS certificates by itself. The uptime monitor should alert on expiry anyway.

## Monthly costs to expect (rough, Nov 2026)
| Item | Note |
|---|---|
| 2 Linux servers in India (staging small, production medium) | the main cost |
| Object storage (photos, private docs, backups) | low at launch |
| Firebase phone auth SMS | per OTP; set a budget alert |
| Domain | yearly |
| Sentry, uptime monitor | free tiers are enough at launch |
| Google Play | one-time registration |

## Rotate secrets (every 6 months, and after anyone leaves)
JWT_ACCESS_SECRET, REFRESH_TOKEN_PEPPER (logs everyone out), ADMIN_SESSION_SECRET, CSRF_SECRET,
storage keys, Redis and Postgres passwords, Firebase service account. Update `infra/api.env`,
redeploy, confirm the old values fail.
