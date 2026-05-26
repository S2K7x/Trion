<p align="center">
  <img src="docs/banner.PNG" alt="Trion — Triage at the speed of threat." width="100%"/>
</p>

# Trion

Self-hosted Security Operations Center platform.
Real-time alert triage, threat intelligence enrichment, and endpoint drift detection.

[Live Demo](https://trion-snowy.vercel.app) &nbsp;·&nbsp; [SOC Dashboard docs](trion-soc/README.md) &nbsp;·&nbsp; [Agent docs](trion-agent/README.md)

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Wazuh-4.9-005571" />
  <img src="https://img.shields.io/badge/n8n-automation-ef6c00" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/ARM64-RPi5-c51a4a?logo=raspberrypi&logoColor=white" />
  <img src="https://img.shields.io/badge/Vercel-deployable-black?logo=vercel" />
  <img src="https://img.shields.io/badge/demo-live-brightgreen" />
</p>

---

## What is Trion?

Trion is two independent security tools that can be used together or on their own:

| Tool | What it does | Guide |
|------|--------------|-------|
| **trion-soc** | Web dashboard — ingests Wazuh alerts through n8n, enriches IOCs, visualises threats in real time | [trion-soc/README.md](trion-soc/README.md) |
| **trion-agent** | Drift detection — takes daily snapshots of a system, detects changes, classifies them with AI | [trion-agent/README.md](trion-agent/README.md) |

Neither component requires the other. Run the dashboard only, the agent only, or both on the same host.

---

## Prerequisites

- **Docker Engine 24+** with **Docker Compose v2** (`docker compose` — note: no hyphen)
- A [Supabase](https://supabase.com) account (free tier is enough) — for the SOC dashboard
- An LLM provider (Ollama local, OpenAI, or Anthropic) — for the drift agent

All Docker images are multi-arch and run on **x86_64 and ARM64 (Raspberry Pi 5)**.

---

## Quick start

### SOC Dashboard (n8n + dashboard)

```bash
git clone https://github.com/S2K7x/Trion
cd Trion/trion-soc
cp .env.example .env.local      # fill in Supabase credentials, dashboard password
docker compose up -d --build    # starts dashboard (port 3000) + n8n (port 5678)
```

Full setup guide → [trion-soc/README.md](trion-soc/README.md)

### Drift Agent

```bash
cd Trion/trion-agent
cp config.toml.example config.toml   # set your LLM provider and Slack webhook
docker compose up -d --build          # starts agent + dashboard (port 8080)
```

Full setup guide → [trion-agent/README.md](trion-agent/README.md)

---

## Alternative: interactive installer

If you prefer a guided setup, `install.sh` prompts for all values and orchestrates Docker for you:

```bash
cd Trion
./install.sh    # interactive — asks for mode, credentials, starts everything
```

---

## Repo structure

```
Trion/
├── trion-soc/                    # SOC web dashboard (Next.js + Supabase)
│   ├── docker-compose.yml        # n8n + dashboard — default stack
│   ├── docker-compose.dev.yml    # n8n only (dev / SQLite)
│   ├── docker-compose.prod.yml   # n8n production (PostgreSQL + Redis + Cloudflare Tunnel)
│   ├── .env.example              # environment variables template
│   └── .env.n8n.example          # n8n production env template
├── trion-agent/                  # Drift detection agent (Python)
│   ├── docker-compose.yml        # agent + dashboard
│   └── config.toml.example       # configuration template
├── wazuh/                        # Wazuh integration
│   ├── docker-compose.yml        # Wazuh single-node stack
│   └── .env.example              # Wazuh env template
├── demo/                         # Standalone demo with mock data — no backend needed
├── docs/                         # Architecture, deployment, and threat-intel docs
├── n8n_workflows/                # n8n workflow JSON files to import
├── install.sh                    # Interactive installer — alternative to manual Docker setup
└── README.md                     # This file
```

---

## Architecture

```
Wazuh endpoints
    └── n8n (soc-ingest → soc-triage → soc-error-handler)
            └── Supabase (PostgreSQL)
                    └── trion-soc dashboard  ← polls every 30s
                                             ← Slack alerts

trion-agent (any host)
    └── daily snapshot diff → LLM classification
            └── Slack (SUSPECT / CRITICAL only)
            └── agent dashboard (port 8080)
```

The two components connect only through external services (Supabase, Slack) — no shared Docker network required.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| SOC Dashboard | Next.js 14 · TypeScript · Tailwind CSS · Recharts |
| Agent Dashboard | FastAPI · Jinja2 · Python 3.11+ |
| Automation | n8n (self-hosted) |
| Database | Supabase (PostgreSQL) |
| SIEM | Wazuh 4.9 |
| Deployment | Docker · Vercel |
| LLM (agent) | Ollama · OpenAI · Anthropic |

---

## Documentation

| File | Contents |
|------|----------|
| [trion-soc/README.md](trion-soc/README.md) | SOC dashboard — setup, env vars, Supabase, Vercel |
| [trion-agent/README.md](trion-agent/README.md) | Drift agent — install, config, CLI, Docker |
| [docs/architecture.md](docs/architecture.md) | n8n workflows, data flow, design decisions |
| [docs/deployment.md](docs/deployment.md) | Deployment modes and environment variables |
| [docs/threat-intel.md](docs/threat-intel.md) | IOC enrichment APIs, rate limits, supported types |

---

## License

MIT
