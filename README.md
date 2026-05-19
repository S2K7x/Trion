<p align="center">
  <img src="docs/banner.PNG" alt="Trion — Triage at the speed of threat." width="100%"/>
</p>

# Trion

Self-hosted Security Operations Center platform.
Real-time alert triage, threat intelligence enrichment, and drift detection.

[Dashboard →](https://mini-soc.vercel.app) · [Docs](#documentation)

<p align="left">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Supabase-PostgreSQL-3ecf8e?logo=supabase&logoColor=white" />
  <img src="https://img.shields.io/badge/Wazuh-4.9-005571" />
  <img src="https://img.shields.io/badge/n8n-automation-ef6c00" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white" />
  <img src="https://img.shields.io/badge/Vercel-deployable-black?logo=vercel" />
  <img src="https://img.shields.io/badge/demo-live-brightgreen?style=flat-square" />
</p>

---

## Two components

Trion is two independent tools that can be used together or separately. The SOC dashboard ingests and triages Wazuh alerts in real time. The drift detection agent runs on any host — no Wazuh required — and detects configuration changes using a local or cloud LLM.

| Component | Description | Docs |
|-----------|-------------|------|
| **Trion SOC** | Self-hosted SOC dashboard — Wazuh + n8n + Supabase + Slack | [docs/](docs/) |
| **trion-agent** | Daily drift detection agent for Linux, macOS, Windows | [trion-agent/](trion-agent/) |

---

## Trion SOC — Quick overview

Trion SOC connects Wazuh agents to a live Next.js dashboard through an automated n8n pipeline. Security events flow from Wazuh endpoints through three n8n workflows (`soc-ingest`, `soc-triage`, `soc-error-handler`) into a Supabase database, where the dashboard polls them every 30 seconds. IOCs are automatically enriched against VirusTotal, AbuseIPDB, and MalwareBazaar before being posted to Slack. A live demo is available at [mini-soc.vercel.app](https://mini-soc.vercel.app) — login: `demo` / `demo1234`.

---

## trion-agent — Quick overview

trion-agent takes daily snapshots of critical system state (ports, services, users, cron, autoruns), diffs them against the previous day, and sends the delta to a LLM for classification (BENIGN / SUSPECT / CRITICAL). Only actionable findings trigger a Slack alert — BENIGN runs are completely silent. See [trion-agent/README.md](trion-agent/README.md) for full setup instructions.

---

## Installation

**Trion SOC**

```bash
git clone https://github.com/S2K7x/Trion
cd Trion
./install.sh
```

The interactive script handles prerequisites, environment configuration, Supabase schema setup, and service launch.

```bash
./install.sh --mode dev          # Next.js dev server + n8n in Docker
./install.sh --mode full         # Everything in Docker Compose
./install.sh --mode full --skip-db   # Skip schema if already applied
```

**trion-agent**

```bash
cd trion-agent
./install.sh    # Linux/macOS
./install.ps1   # Windows
```

---

## Documentation

| File | Description |
|------|-------------|
| [docs/architecture.md](docs/architecture.md) | n8n workflows, data flow, key design decisions |
| [docs/deployment.md](docs/deployment.md) | Deployment modes, prerequisites, environment variables |
| [docs/threat-intel.md](docs/threat-intel.md) | Threat intel APIs, rate limits, IOC types |
| [trion-agent/README.md](trion-agent/README.md) | trion-agent full documentation |

---

## Architecture

```
Wazuh agents → n8n (soc-ingest → soc-triage) → Supabase → Dashboard
                                              ↘ Slack
trion-agent (any host) → LLM → Slack
```

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + Tailwind CSS + Recharts |
| Automation | n8n (self-hosted) |
| Database | Supabase (PostgreSQL) |
| SIEM | Wazuh 4.9 |
| Deployment | Vercel + Raspberry Pi 5 |
| Agent LLM | Ollama / OpenAI / Anthropic |

---

## License

MIT
