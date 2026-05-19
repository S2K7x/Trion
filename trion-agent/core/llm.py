"""Provider-agnostic LLM interface for drift analysis."""
import json
import logging
import socket
from datetime import date

import requests

logger = logging.getLogger(__name__)

_SYSTEM_LINUX = """You are a Linux security analyst embedded in an automated daily drift detection agent.
You receive structured diffs from a monitored host. Each diff shows what changed between yesterday and today for a specific system check.

Your job is to classify each change as:
- BENIGN   : expected system behavior, routine update, known pattern
- SUSPECT  : unusual but not confirmed malicious, warrants human review
- CRITICAL : high confidence indicator of compromise or serious misconfiguration

Rules:
- Be concise. One classification per changed item.
- Explain your reasoning in one sentence maximum.
- If nothing changed, respond with BENIGN and reason "No changes detected".
- Never ask for clarification. Always produce a verdict.
- Assume a standard Linux server environment (Ubuntu/Debian/RHEL).
- Common BENIGN patterns: package updates, log rotation, temp files, known daemons (sshd, cron, systemd-*), scheduled jobs.
- Common SUSPECT patterns: new listening port, new user added, new cron entry, unexpected binary in PATH, new SUID file.
- Common CRITICAL patterns: root shell added, SSH key injected, LD_PRELOAD modified, new service pointing to /tmp, passwd hash changed.

Output ONLY valid JSON, no markdown, no explanation outside JSON:
{
  "verdict": "BENIGN|SUSPECT|CRITICAL",
  "confidence": 0-100,
  "changes": [
    {
      "item": "description of the changed item",
      "verdict": "BENIGN|SUSPECT|CRITICAL",
      "reason": "one sentence"
    }
  ],
  "summary": "one sentence global assessment"
}"""

_SYSTEM_MACOS = """You are a macOS security analyst embedded in an automated daily drift detection agent.
You receive structured diffs from a monitored workstation.

Your job is to classify each change as BENIGN, SUSPECT, or CRITICAL.

Rules:
- Be concise. One classification per changed item.
- Explain your reasoning in one sentence maximum.
- Never ask for clarification. Always produce a verdict.
- Assume a standard macOS workstation (Sonoma/Ventura).
- Common BENIGN patterns: Apple system daemons (com.apple.*), Homebrew services, known app LaunchAgents (Adobe, Dropbox, Zoom).
- Common SUSPECT patterns: unknown LaunchAgent plist, new entry in /Library/LaunchDaemons from non-Apple vendor, unexpected binary in ~/Library/.
- Common CRITICAL patterns: LaunchAgent pointing to /tmp or executing curl/bash, SSH key added without user action, TCC database modified.

Output ONLY valid JSON, no markdown:
{
  "verdict": "BENIGN|SUSPECT|CRITICAL",
  "confidence": 0-100,
  "changes": [
    {
      "item": "description of the changed item",
      "verdict": "BENIGN|SUSPECT|CRITICAL",
      "reason": "one sentence"
    }
  ],
  "summary": "one sentence global assessment"
}"""

_SYSTEM_WINDOWS = """You are a Windows security analyst embedded in an automated daily drift detection agent.
You receive structured diffs from a monitored Windows host (PowerShell output format).

Your job is to classify each change as BENIGN, SUSPECT, or CRITICAL.

Rules:
- Be concise. One classification per changed item.
- Explain your reasoning in one sentence maximum.
- Never ask for clarification. Always produce a verdict.
- Assume a standard Windows 10/11 workstation or Windows Server environment.
- Common BENIGN patterns: Microsoft services, Windows Defender, known software autoruns (Teams, OneDrive, Office), Windows Update artifacts.
- Common SUSPECT patterns: new scheduled task with encoded PowerShell, new autorun entry from unknown path, new local user added, service pointing to TEMP folder.
- Common CRITICAL patterns: new admin user added, autorun pointing to AppData with random name, PowerShell execution policy changed to Bypass, LSASS access detected.

Output ONLY valid JSON, no markdown:
{
  "verdict": "BENIGN|SUSPECT|CRITICAL",
  "confidence": 0-100,
  "changes": [
    {
      "item": "description of the changed item",
      "verdict": "BENIGN|SUSPECT|CRITICAL",
      "reason": "one sentence"
    }
  ],
  "summary": "one sentence global assessment"
}"""

_SYSTEM_PROMPTS = {
    "linux": _SYSTEM_LINUX,
    "macos": _SYSTEM_MACOS,
    "windows": _SYSTEM_WINDOWS,
}

# llm_error=True signals to the caller that the baseline should NOT be updated
_FALLBACK = {
    "verdict": "SUSPECT",
    "confidence": 0,
    "changes": [],
    "summary": "LLM response parsing failed",
    "llm_error": True,
}

_MAX_CONTEXT_CHARS = 8000
_MAX_LINES_PER_SIDE = 50


def build_prompt(context: dict, os_type: str) -> str:
    """Build the full prompt string combining system instructions and context JSON."""
    system = _SYSTEM_PROMPTS.get(os_type, _SYSTEM_LINUX)
    return f"{system}\n\nContext:\n{json.dumps(context, indent=2)}"


def _truncate_context(context: dict) -> dict:
    """Truncate diffs to cap each side at _MAX_LINES_PER_SIDE lines per command."""
    truncated = dict(context)
    diffs = []
    for d in context.get("diffs", []):
        entry = dict(d)
        if len(entry.get("added", [])) > _MAX_LINES_PER_SIDE:
            entry["added"] = entry["added"][:_MAX_LINES_PER_SIDE]
        if len(entry.get("removed", [])) > _MAX_LINES_PER_SIDE:
            entry["removed"] = entry["removed"][:_MAX_LINES_PER_SIDE]
        diffs.append(entry)
    truncated["diffs"] = diffs
    return truncated


def parse_response(raw: str) -> dict:
    """Parse LLM JSON response; return SUSPECT fallback on failure."""
    try:
        result = json.loads(raw)
        # Successful parse — ensure no llm_error flag leaks through
        result.pop("llm_error", None)
        return result
    except (json.JSONDecodeError, KeyError) as exc:
        logger.error("LLM response parse error: %s — raw: %.200s", exc, raw)
        return dict(_FALLBACK)


def analyze(diffs: list[dict], config: dict, os_type: str) -> dict:
    """Send diffs to the configured LLM provider and return the verdict dict."""
    context = {
        "host": socket.gethostname(),
        "os": os_type,
        "date": str(date.today()),
        "module": config.get("_module", "unknown"),
        "diffs": diffs,
    }

    original_size = len(json.dumps(context))
    if original_size > _MAX_CONTEXT_CHARS:
        context = _truncate_context(context)
        truncated_size = len(json.dumps(context))
        logger.warning(
            "Context truncated from %d to %d chars for LLM call",
            original_size,
            truncated_size,
        )

    provider = config.get("provider", "ollama")
    timeout = int(config.get("timeout", 30))
    prompt = build_prompt(context, os_type)

    try:
        if provider == "ollama":
            return _call_ollama(prompt, config, timeout)
        elif provider == "openai":
            return _call_openai(prompt, config, timeout)
        elif provider == "anthropic":
            return _call_anthropic(prompt, config, timeout)
        else:
            logger.error("Unknown LLM provider: %s", provider)
            return dict(_FALLBACK)
    except requests.Timeout:
        logger.warning("LLM timeout after %ds (%s)", timeout, provider)
        return dict(_FALLBACK)
    except requests.ConnectionError:
        logger.error("LLM unreachable (%s @ %s)", provider, config.get("endpoint", ""))
        return dict(_FALLBACK)
    except requests.RequestException as exc:
        logger.error("LLM request failed (%s): %s", provider, exc)
        return dict(_FALLBACK)


def _call_ollama(prompt: str, config: dict, timeout: int) -> dict:
    endpoint = config.get("endpoint", "http://localhost:11434")
    resp = requests.post(
        f"{endpoint}/api/generate",
        json={"model": config["model"], "prompt": prompt, "stream": False},
        timeout=timeout,
    )
    resp.raise_for_status()
    return parse_response(resp.json()["response"])


def _call_openai(prompt: str, config: dict, timeout: int) -> dict:
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {config['api_key']}"},
        json={
            "model": config["model"],
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"},
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return parse_response(resp.json()["choices"][0]["message"]["content"])


def _call_anthropic(prompt: str, config: dict, timeout: int) -> dict:
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": config["api_key"],
            "anthropic-version": "2023-06-01",
        },
        json={
            "model": config["model"],
            "max_tokens": 1024,
            "messages": [{"role": "user", "content": prompt}],
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return parse_response(resp.json()["content"][0]["text"])
