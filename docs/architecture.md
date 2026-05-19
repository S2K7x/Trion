# Trion — Architecture

## Data flow

```
Wazuh agent (endpoint)
  → wazuh-integratord → custom-n8n script
  → POST /webhook/wazuh-ingest (n8n)

n8n: soc-ingest
  → validate + normalise payload
  → extract IOCs (srcip, dstip, url, sha256, md5)
  → filter private/loopback ranges (RFC 1918, ::1)
  → build SHA-1 dedup_key
  → Supabase INSERT (conflict on dedup_key → ignore)

n8n: soc-triage (every 30s)
  → reset stale jobs (processing > 10min → pending)
  → fetch pending alerts (cap: 5/cycle)
  → enrich each IOC: VirusTotal + AbuseIPDB (IP) | VirusTotal + MalwareBazaar (hash) | VirusTotal (domain)
  → update alert with verdicts (CLEAN / SUSPICIOUS / MALICIOUS / UNKNOWN)
  → POST formatted message to Slack
  → mark alert done

n8n: soc-error-handler
  → re-queue alerts stuck in error status → pending

Supabase (PostgreSQL)
  → alert_queue table
  → 4 RPC functions queried by the dashboard

Dashboard (Next.js — polling every 30s)
  → GET /api/stats → 9 parallel Supabase queries
  → KPIs, 24h trend, top rules, IOC leaderboard, workflow status
```

---

## n8n workflows

### soc-ingest

Triggered by a Wazuh webhook. Accepts `POST /webhook/wazuh-ingest`, validates the payload, extracts IOC candidates from alert fields, filters out private/loopback addresses, builds a SHA-1 deduplication key, and inserts into Supabase. Duplicate alerts (same dedup_key) are silently ignored via `ON CONFLICT DO NOTHING`.

**IOC extraction fields:**

| Wazuh field | IOC type |
|-------------|----------|
| `data.srcip` / `data.dstip` | IP address |
| `data.url` | Domain / URL |
| `syscheck.sha256_after` | SHA-256 file hash |
| `syscheck.md5_after` | MD5 file hash |

### soc-triage

Runs on a 30-second schedule. Processes up to 5 alerts per cycle to prevent queue saturation. Each alert's IOCs are enriched one at a time against the threat intel APIs, then a formatted Slack message is posted with all verdicts. Possible verdicts: `CLEAN` · `SUSPICIOUS` · `MALICIOUS` · `UNKNOWN` (API unavailable or no data).

### soc-error-handler

Retries alerts in `error` status by resetting them to `pending`. Prevents alerts from being permanently lost due to transient API failures.

---

## Key design decisions

**Max Concurrency = 1 (race condition)**
soc-triage processes one alert at a time within each cycle. Running multiple triage executions in parallel against the same `alert_queue` rows would cause race conditions on the `status` field transitions (`pending → processing → done`).

**`dedup_key` UNIQUE constraint**
A SHA-1 fingerprint of the alert payload is computed in soc-ingest. Supabase enforces uniqueness, so re-delivered webhooks (Wazuh retries on integrator failure) are discarded at the database level — no application logic required.

**Wait 15s between VirusTotal calls**
VirusTotal free tier is limited to 4 requests per minute. A 15-second wait node in soc-triage between IOC enrichment calls ensures the rate limit is respected even when an alert has multiple IOCs.

**Stale jobs reset at 10 minutes**
If soc-triage crashes mid-processing, an alert can be stuck in `processing` indefinitely. At the start of each soc-triage run, rows in `processing` for more than 10 minutes are reset to `pending` and will be retried on the next cycle.

**Never DELETE — audit trail permanent**
Alerts are never deleted from `alert_queue`. Status transitions are append-only (`pending → processing → done | error`). This preserves a complete audit trail and allows forensic review of past alerts.

**`SUPABASE_SERVICE_KEY` server-side only**
The service_role key bypasses Row Level Security. It is used exclusively in `lib/supabase-server.ts`, which runs only in Next.js API routes (server-side). It is never bundled into the client JavaScript and never exposed via `NEXT_PUBLIC_*` variables.
