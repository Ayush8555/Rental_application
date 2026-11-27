#!/usr/bin/env bash
# Deploy the current checkout on this server. Run by CI (staging) or by hand
# with a tag checked out (production).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose --env-file .env build
docker compose --env-file .env run --rm -e DATABASE_URL="${MIGRATION_DATABASE_URL:?}" api npx prisma migrate deploy
docker compose --env-file .env exec -T postgres psql -U rentnook_owner -d rentnook -f - < postgres/after-migrate.sql
docker compose --env-file .env up -d --remove-orphans
sleep 5
curl -fsS "https://${API_HOST:-api.rentnook.in}/health" >/dev/null && echo "deployed and healthy"
