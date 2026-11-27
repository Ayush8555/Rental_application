#!/usr/bin/env bash
# Nightly encrypted database backup (cron: 30 2 * * *).
# Needs: age (https://age-encryption.org) public key in BACKUP_AGE_RECIPIENT,
# and an rclone remote "offsite" pointing at storage in a separate account.
set -euo pipefail
cd "$(dirname "$0")/.."
stamp=$(date +%Y-%m-%d_%H%M)
file="rentnook_${stamp}.sql.gz.age"
docker compose exec -T postgres pg_dump -U rentnook_owner -d rentnook --no-owner --format=plain \
  | gzip -9 \
  | age -r "${BACKUP_AGE_RECIPIENT:?set BACKUP_AGE_RECIPIENT}" > "/var/backups/rentnook/${file}"
chmod 600 "/var/backups/rentnook/${file}"
rclone copy "/var/backups/rentnook/${file}" offsite:rentnook-backups/db/
# Keep 30 days locally and offsite.
find /var/backups/rentnook -name 'rentnook_*.sql.gz.age' -mtime +30 -delete
rclone delete --min-age 30d offsite:rentnook-backups/db/
echo "backup ok: ${file}"
