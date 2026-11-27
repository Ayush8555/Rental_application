-- Runs once when the database volume is first created.
-- rentnook_owner (superuser created by the image) owns the schema and runs
-- migrations. The API connects as rentnook_app, which can read and write
-- data but cannot change the schema or touch the audit trail.

\set app_password `cat /run/secrets/pg_app_password`

CREATE ROLE rentnook_app LOGIN PASSWORD :'app_password';
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO rentnook_app;
ALTER DEFAULT PRIVILEGES FOR ROLE rentnook_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rentnook_app;
ALTER DEFAULT PRIVILEGES FOR ROLE rentnook_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO rentnook_app;
