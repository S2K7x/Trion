# trion-agent

Daily drift detection agent for Linux, macOS, and Windows.
Part of the [Trion](https://github.com/S2K7x/Trion) SOC platform.

---

## What it does

Trion-agent takes a daily snapshot of critical system state (open ports, running services, users, cron jobs, autoruns), diffs it against the previous day's baseline, and sends the delta to a local or cloud LLM that classifies each change as BENIGN, SUSPECT, or CRITICAL. Only actionable findings trigger a Slack notification — BENIGN runs are completely silent.

## Architecture

```
agent.py → collector → differ → llm → notifier
```

- Baseline stored locally as `data/baseline.json` (never deleted — permanent audit trail)
- Dated snapshots archived in `data/snapshots/` for forensic review
- LLM receives only the diffs, never full file contents
- Provider-agnostic: Ollama (local), OpenAI, Anthropic

## Modules

| Module | Default | Description |
|--------|---------|-------------|
| `config-drift` | enabled | Monitors open ports, running services, users, cron, autoruns |
| `threat-detection` | disabled | Monitors login history, failed auth, SUID files, suspicious processes |

## Requirements

- Python 3.11+
- pip
- A LLM provider: Ollama (local, no API key) or an OpenAI / Anthropic API key

## Installation

**Linux / macOS**
```bash
git clone https://github.com/S2K7x/Trion
cd Trion/trion-agent
./install.sh
```

**Windows**
```powershell
git clone https://github.com/S2K7x/Trion
cd Trion/trion-agent
./install.ps1
```

The install script:
1. Installs Python dependencies
2. Copies `config.toml.example` → `config.toml` (permissions set to 600 automatically)
3. Registers a daily 07:00 run via systemd timer (Linux), LaunchAgent (macOS), or Scheduled Task (Windows)

## Configuration

Edit `config.toml` before the first run. Required fields:

- `notifications.slack_webhook` — Slack Incoming Webhook URL
- `llm.provider` — `ollama` | `openai` | `anthropic`
- `llm.api_key` — required if provider is not `ollama`
- `llm.model` — depends on the provider

| Provider | Model example | api_key required |
|----------|--------------|-----------------|
| `ollama` | `llama3.2` | No |
| `openai` | `gpt-4o-mini` | Yes |
| `anthropic` | `claude-haiku-4-5` | Yes |

## Usage

```bash
python3 agent.py --run-now    # run immediately
python3 agent.py --dry-run    # show diffs, no LLM/Slack/baseline update
python3 agent.py --status     # show agent state
python3 agent.py --debug      # verbose logging
```

## Slack notifications

**CRITICAL**
```
🔴 *CRITICAL* — hostname
Module: config-drift | 2026-05-19

• new LISTEN port 4444 — unexpected service binding on non-standard port
• /etc/passwd modified — new entry added outside package manager

Confidence: 92% | @channel
```

**SUSPECT**
```
🟡 *SUSPECT* — hostname
Module: config-drift | 2026-05-19

• new cron entry for root — unusual schedule, warrants review

Confidence: 65%
```

BENIGN verdicts produce no notification.

## Adding custom commands

Override the built-in command list per module in `config.toml`:

```toml
[modules.config-drift]
enabled = true
commands = [
  "ls -la /opt/",
  "cat /etc/hosts",
]
```

When `commands` is set, the built-in list is replaced entirely. Commands containing `;` `&` `|` `` ` `` `$` `(` `)` `{` `}` are rejected at runtime for security.

## Security notes

- `config.toml` permissions: `600` (set automatically by `install.sh`)
- `data/` permissions: `700` (set automatically)
- The LLM receives only diffs, never full file contents
- Baseline is never deleted — overwritten only, preserving audit trail
- Shell injection protection applied to all user-defined commands

## Standalone vs Trion

Trion-agent runs fully standalone — no Wazuh, no n8n, no Trion dashboard required. It reads its config from `config.toml` and sends alerts directly to Slack.
