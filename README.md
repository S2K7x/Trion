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

## Repo structure

```
Trion/
├── trion-soc/                    # SOC web dashboard (Next.js + Supabase)
├── trion-agent/                  # Drift detection agent (Python)
├── demo/                         # Standalone demo with mock data — no backend needed
├── docs/                         # Architecture, deployment, and threat-intel docs
├── wazuh/                        # Wazuh integration scripts (custom-n8n, ossec config)
├── n8n_workflows/                # n8n workflow JSON files to import
│
├── docker-compose.soc.yaml       # SOC dashboard + n8n — full stack in one command
├── docker-compose.yaml           # n8n only — for local dev alongside npm run dev
├── docker-compose.n8n-prod.yaml  # n8n production (PostgreSQL + Redis + Cloudflare Tunnel)
├── docker-compose.wazuh.yaml     # Wazuh stack
│
├── install.sh                    # Interactive installer — handles everything for you
└── README.md                     # This file
```

---

## Quick start

### SOC Dashboard

```bash
git clone https://github.com/S2K7x/Trion
cd Trion
./install.sh
```

The script asks a few questions (Supabase credentials, dashboard password) and starts everything.
Full setup guide: [trion-soc/README.md](trion-soc/README.md)

### Drift Agent

```bash
cd trion-agent
./install.sh          # Linux / macOS
# or
./install.ps1         # Windows
```

Full setup guide: [trion-agent/README.md](trion-agent/README.md)

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

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| SOC Dashboard | Next.js 14 · TypeScript · Tailwind CSS · Recharts |
| Agent Dashboard | FastAPI · Jinja2 · Python 3.11+ |
| Automation | n8n (self-hosted) |
| Database | Supabase (PostgreSQL) |
| SIEM | Wazuh 4.9 |
| Deployment | Vercel · Docker |
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
