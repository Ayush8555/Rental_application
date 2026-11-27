#!/usr/bin/env bash
# Restore a backup into a FRESH database (monthly drill, P6-05).
#   ./restore.sh rentnook_2026-11-26_0230.sql.gz.age
# Needs the age private key (from the password manager) in BACKUP_AGE_KEY_FILE.
set -euo pipefail
cd "$(dirname "$0")/.."
src="${1:?backup file name}"
rclone copy "offsite:rentnook-backups/db/${src}" /tmp/
age -d -i "${BACKUP_AGE_KEY_FILE:?}" "/tmp/${src}" | gunzip | docker compose exec -T postgres psql -U rentnook_owner -d rentnook_restore_check
rm -f "/tmp/${src}"
echo "restored into rentnook_restore_check; point a staging API at it and smoke test"
