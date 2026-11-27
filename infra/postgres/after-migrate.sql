-- Run after every `prisma migrate deploy` (scripts/deploy.sh does this).
-- Audit and consent logs are append-only for the app role; the database
-- trigger blocks edits too, this removes the permission as well.
REVOKE UPDATE, DELETE, TRUNCATE ON "AuditLog" FROM rentnook_app;
REVOKE UPDATE, DELETE, TRUNCATE ON "ConsentLog" FROM rentnook_app;
REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM rentnook_app;
