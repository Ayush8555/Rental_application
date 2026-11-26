-- Full-text search over title + description. 'simple' config because a lot of
-- titles are Hinglish ("cycle kiraye pe") and English stemming hurts there.
CREATE INDEX "Listing_search_idx" ON "Listing"
  USING GIN (to_tsvector('simple', coalesce("title", '') || ' ' || coalesce("description", '')));

-- Trigram index keeps short prefix searches ("cano" -> canon) fast too.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Listing_title_trgm_idx" ON "Listing" USING GIN ("title" gin_trgm_ops);

-- Audit log is append-only. Even if someone gets the app's DB password,
-- they cannot rewrite history through it.
CREATE OR REPLACE FUNCTION audit_log_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog rows cannot be changed or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();

CREATE TRIGGER consent_log_no_delete BEFORE DELETE ON "ConsentLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();
