-- Trion SOC — schéma initial
-- Appliquer via : supabase db push  OU  coller dans Supabase SQL Editor

-- ── Table principale ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alert_queue (
  id           bigserial PRIMARY KEY,
  dedup_key    text UNIQUE,
  raw_alert    jsonb NOT NULL,
  rule_id      text,
  rule_level   integer,
  rule_desc    text,
  agent_name   text,
  agent_ip     text,
  username     text,
  command      text,
  iocs         jsonb DEFAULT '[]'::jsonb,
  status       text DEFAULT 'pending'
                 CHECK (status IN ('pending','processing','done','error')),
  retry_count  integer DEFAULT 0,
  created_at   timestamptz DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_alert_queue_created_at  ON alert_queue (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_queue_status      ON alert_queue (status);
CREATE INDEX IF NOT EXISTS idx_alert_queue_rule_level  ON alert_queue (rule_level);

-- ── Fonctions RPC ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_error_rate()
RETURNS TABLE(error_rate numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT CASE WHEN COUNT(*) = 0 THEN 0
    ELSE ROUND(COUNT(*) FILTER (WHERE status = 'error') * 100.0 / COUNT(*), 1)
  END FROM alert_queue WHERE created_at >= NOW() - INTERVAL '24 hours';
$$;

CREATE OR REPLACE FUNCTION get_dashboard_trend()
RETURNS TABLE(hour timestamptz, count bigint, critical bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT date_trunc('hour', created_at),
    COUNT(*), COUNT(*) FILTER (WHERE rule_level >= 12)
  FROM alert_queue WHERE created_at >= NOW() - INTERVAL '24 hours'
  GROUP BY 1 ORDER BY 1 ASC;
$$;

CREATE OR REPLACE FUNCTION get_top_rules()
RETURNS TABLE(rule_id text, rule_desc text, count bigint)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT rule_id, rule_desc, COUNT(*)
  FROM alert_queue
  WHERE created_at >= NOW() - INTERVAL '7 days' AND rule_id IS NOT NULL
  GROUP BY rule_id, rule_desc ORDER BY 3 DESC LIMIT 10;
$$;

CREATE OR REPLACE FUNCTION get_top_iocs()
RETURNS TABLE(ioc_value text, ioc_type text, verdict text, occurrences bigint, last_seen timestamptz)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT ioc->>'value', ioc->>'type', ioc->>'verdict', COUNT(*), MAX(created_at)
  FROM alert_queue, jsonb_array_elements(iocs) AS ioc
  WHERE created_at >= NOW() - INTERVAL '7 days' AND ioc->>'verdict' = 'MALICIOUS'
  GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 20;
$$;
