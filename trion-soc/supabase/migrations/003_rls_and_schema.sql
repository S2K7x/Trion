-- 003: Add llm_verdict column, app_url seed, and Row Level Security
-- Safe to apply on fresh or existing databases (all statements are idempotent).

-- ── alert_queue: llm_verdict column ──────────────────────────────────────────
ALTER TABLE alert_queue ADD COLUMN IF NOT EXISTS llm_verdict jsonb;

-- ── trion_config: seed app_url ───────────────────────────────────────────────
INSERT INTO trion_config (key, value)
VALUES ('app_url', '')
ON CONFLICT (key) DO NOTHING;

-- ── Row Level Security ───────────────────────────────────────────────────────
-- The SUPABASE_SERVICE_KEY (used by all server-side routes and n8n) bypasses
-- RLS entirely — these settings restrict the public anon key only.
-- Default: no policy = deny all anon access.

ALTER TABLE alert_queue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE trion_config ENABLE ROW LEVEL SECURITY;
