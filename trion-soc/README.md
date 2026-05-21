<p align="center">
  <img src="../docs/banner.PNG" alt="Trion SOC" width="100%"/>
</p>

# trion-soc

SOC web dashboard for the [Trion](../README.md) platform.

Receives Wazuh security events through n8n, enriches IOCs automatically, and displays everything in a real-time dashboard backed by Supabase — no page refresh needed.

[Live demo](https://trion-snowy.vercel.app) · login: `demo`

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Vercel-deployable-black?logo=vercel" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/Part%20of-Trion-f85149" />
</p>

---

## What the dashboard shows

- Live alert feed from Wazuh — updates every 30 seconds
- IOC enrichment results (VirusTotal, AbuseIPDB, MalwareBazaar)
- Alert timeline and 24-hour trend chart
- Top triggered rules over 7 days
- n8n workflow health (soc-ingest, soc-triage, soc-error-handler)
- Reputation search — look up any IP, domain, or hash on demand

---

## Prerequisites

| What | Why |
|------|-----|
| [Supabase](https://supabase.com) account | Stores alerts — free tier is enough |
| n8n instance | Receives Wazuh webhooks and feeds Supabase |
| Node.js 18+ | Only needed for local dev mode |
| Docker | Only needed for the container deployment |

---

## Three ways to run it

### Option 1 — Local dev (quickest to start)

Run the script from the repo root — it configures everything interactively:

```bash
# From Trion/
./install.sh --mode dev
```

Or do it manually:

```bash
cd trion-soc
cp .env.example .env.local    # open .env.local and fill in your values
npm install
npm run dev
```

Dashboard available at `http://localhost:3000`.

---

### Option 2 — Full Docker (recommended for a home lab or server)

Starts the dashboard and n8n together in containers:

```bash
# From Trion/
./install.sh --mode full
```

Alternatively:

```bash
cp trion-soc/.env.example trion-soc/.env.local   # fill in your values
docker compose -f docker-compose.soc.yaml up -d --build
```

- Dashboard → `http://localhost:3000`
- n8n → `http://localhost:5678`

To stop: `docker compose -f docker-compose.soc.yaml down`

---

### Option 3 — Vercel (public deployment)

1. Import the repo on [vercel.com](https://vercel.com) → **Add New Project**
2. Set **Root Directory** to `trion-soc`
3. Add the environment variables listed in the next section
4. Click **Deploy**

No build command needed — Vercel detects Next.js automatically.

---

## Environment variables

Copy `trion-soc/.env.example` to `trion-soc/.env.local` and fill in the values.
For Vercel, add them under **Project Settings → Environment Variables**.

| Variable | Required | How to get it |
|----------|----------|---------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase → Project Settings → API → anon public |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase → Project Settings → API → service_role secret |
| `DASHBOARD_PASSWORD` | Yes | Choose any password — used to log in |
| `DASHBOARD_SECRET` | Yes | Random string: `openssl rand -hex 32` |
| `MASTER_SECRET` | Yes | Random string: `openssl rand -hex 32` |
| `N8N_API_URL` | No | URL of your n8n instance (default: `http://localhost:5678`) |
| `N8N_API_KEY` | No | n8n → Settings → API — needed for workflow status cards |

> `SUPABASE_SERVICE_KEY` is used server-side only and is never exposed to the browser.

---

## Supabase setup

Apply the three migration files **in order** using the SQL editor in your Supabase project
(**SQL Editor → New query → paste → Run**):

| Order | File | What it creates |
|-------|------|-----------------|
| 1 | [`supabase/migrations/001_init.sql`](supabase/migrations/001_init.sql) | `alert_queue` table |
| 2 | [`supabase/migrations/002_trion_config.sql`](supabase/migrations/002_trion_config.sql) | Config storage |
| 3 | [`supabase/migrations/003_rls_and_schema.sql`](supabase/migrations/003_rls_and_schema.sql) | RLS policies and RPC functions |

If you have the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and linked, `install.sh` does this automatically.

---

## n8n workflows

Three workflows connect Wazuh to the dashboard. Import them from `../n8n_workflows/` into your n8n instance (**Workflows → Import from file**):

| Workflow | Role |
|----------|------|
| `soc-ingest` | Receives Wazuh webhook, normalises the event, writes to Supabase |
| `soc-triage` | Enriches IOCs via VirusTotal / AbuseIPDB / MalwareBazaar, posts to Slack |
| `soc-error-handler` | Retries failed events, marks unrecoverable ones as `error` |

---

## Wazuh integration

Run these commands on your **Wazuh Manager** (not an agent):

```bash
# 1. Install the integration script
cp ../wazuh/custom-n8n /var/ossec/integrations/
chmod 750 /var/ossec/integrations/custom-n8n
chown root:wazuh /var/ossec/integrations/custom-n8n

# 2. Add the integration block to ossec.conf
# Open /var/ossec/etc/ossec.conf and paste the contents of ../wazuh/ossec-integration.conf
# inside the <ossec_config> tag, then restart the manager:
systemctl restart wazuh-manager
```

The minimum alert level recommended is `7` (medium+). Events below that level are not forwarded.

Full details: [`../wazuh/`](../wazuh/) · [`../docs/architecture.md`](../docs/architecture.md)

---

## Data flow

```
Wazuh endpoint
    └── wazuh-integratord
            └── custom-n8n (Python)
                    └── POST /webhook/wazuh-ingest → n8n
                                └── soc-ingest → Supabase alert_queue
                                └── soc-triage → IOC APIs → Slack
                                └── soc-error-handler

Supabase alert_queue
    └── /api/stats (Next.js route)
            └── dashboard ← polls every 30s
```

---

## Folder structure

```
trion-soc/
├── app/
│   ├── (dashboard)/          # All authenticated pages (alerts, IOCs, timeline…)
│   ├── api/                  # API routes (stats, auth, config, health)
│   ├── login/                # Login page
│   └── setup/                # First-run setup wizard
├── components/               # React components
│   ├── charts/               # Recharts wrappers (client-only)
│   └── primitives/           # Shared UI atoms (Button, Panel, SeverityChip…)
├── lib/
│   ├── queries.ts            # All Supabase queries in one place
│   ├── supabase-server.ts    # Server-side Supabase client
│   ├── types.ts              # TypeScript interfaces
│   ├── design.ts             # Severity colour mapping
│   └── config-crypto.ts      # AES-256-GCM encryption for stored API keys
├── middleware.ts             # JWT auth check on every route except /login
├── supabase/migrations/      # SQL migration files
└── Dockerfile                # Production image (node:20-alpine, standalone output)
```

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Database client | Supabase JS v2 |
| Auth | JWT via jose — single password, HttpOnly cookie, 24h session |
| Deployment | Vercel · Docker (standalone Next.js output) |
