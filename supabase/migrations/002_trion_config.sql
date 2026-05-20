CREATE TABLE IF NOT EXISTS trion_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO trion_config (key, value)
VALUES ('setup_complete', 'false')
ON CONFLICT (key) DO NOTHING;
