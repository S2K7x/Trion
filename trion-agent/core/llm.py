"""Provider-agnostic LLM interface for drift analysis."""
import json
import logging
import socket
from datetime import date
from typing import Any

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


def _system_prompt(os_type: str) -> str:
    """Return the system-role instructions for the given OS type."""
    return _SYSTEM_PROMPTS.get(os_type, _SYSTEM_LINUX)


def _context_text(context: dict[str, Any]) -> str:
    """Serialise the diff context as the user-role content."""
    return f"Context:\n{json.dumps(context, indent=2)}"


def build_prompt(context: dict[str, Any], os_type: str) -> str:
    """Build a single prompt string (used for Ollama which has no role separation)."""
    return f"{_system_prompt(os_type)}\n\n{_context_text(context)}"


def _truncate_context(context: dict[str, Any]) -> dict[str, Any]:
    """Truncate diffs until the serialised context fits within _MAX_CONTEXT_CHARS.

    Strategy:
    1. Cap each diff entry at _MAX_LINES_PER_SIDE lines per side.
    2. If the result still exceeds the char limit, drop diffs from the end
       until it fits, keeping at least the first entry.
    """
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

    # Drop trailing diffs until the context fits within the char budget.
    while len(diffs) > 1 and len(json.dumps(truncated)) > _MAX_CONTEXT_CHARS:
        diffs = diffs[:-1]
        truncated["diffs"] = diffs
        logger.warning("Context still over limit — dropped a diff entry (%d remaining)", len(diffs))

    return truncated


_VALID_VERDICTS = frozenset({"BENIGN", "SUSPECT", "CRITICAL"})


def parse_response(raw: str) -> dict[str, Any]:
    """Parse LLM JSON response; return SUSPECT fallback on failure."""
    try:
        result = json.loads(raw)
        # Successful parse — ensure no llm_error flag leaks through
        result.pop("llm_error", None)
        verdict = result.get("verdict", "")
        if verdict not in _VALID_VERDICTS:
            logger.warning(
                "LLM returned unknown verdict %r — treating as SUSPECT", verdict
            )
            result["verdict"] = "SUSPECT"
            # Don't set llm_error — LLM responded successfully, verdict is just coerced
        return result
    except (json.JSONDecodeError, KeyError) as exc:
        logger.error("LLM response parse error: %s — raw: %.200s", exc, raw)
        return dict(_FALLBACK)


def analyze(diffs: list[dict[str, Any]], config: dict[str, Any], os_type: str) -> dict[str, Any]:
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

    try:
        if provider == "ollama":
            return _call_ollama(context, os_type, config, timeout)
        elif provider == "openai":
            return _call_openai(context, os_type, config, timeout)
        elif provider == "anthropic":
            return _call_anthropic(context, os_type, config, timeout)
        else:
            logger.error("Unknown LLM provider: %s", provider)
            return dict(_FALLBACK)
    except requests.Timeout:
        logger.warning("LLM timeout after %ds (%s)", timeout, provider)
        return dict(_FALLBACK)
    except requests.ConnectionError:
        # Redact credentials that may be embedded in the endpoint URL.
        raw_endpoint = config.get("endpoint", "")
        safe_endpoint = raw_endpoint.split("@")[-1] if "@" in raw_endpoint else raw_endpoint
        logger.error("LLM unreachable (%s @ %s)", provider, safe_endpoint)
        return dict(_FALLBACK)
    except requests.RequestException as exc:
        logger.error("LLM request failed (%s): %s", provider, exc)
        return dict(_FALLBACK)


def _call_ollama(context: dict[str, Any], os_type: str, config: dict[str, Any], timeout: int) -> dict[str, Any]:
    # Ollama /api/generate has no role concept — combine into a single prompt string.
    prompt = build_prompt(context, os_type)
    endpoint = config.get("endpoint", "http://localhost:11434")
    resp = requests.post(
        f"{endpoint}/api/generate",
        json={"model": config["model"], "prompt": prompt, "stream": False},
        timeout=timeout,
    )
    resp.raise_for_status()
    return parse_response(resp.json()["response"])


def _call_openai(context: dict[str, Any], os_type: str, config: dict[str, Any], timeout: int) -> dict[str, Any]:
    api_key = config.get("api_key", "")
    if not api_key:
        logger.error("openai provider requires api_key in config")
        return dict(_FALLBACK)
    resp = requests.post(
        "https://api.openai.com/v1/chat/completions",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "model": config["model"],
            # System prompt in the system role; diff data in the user role.
            # This limits the effectiveness of prompt injection via diff content.
            "messages": [
                {"role": "system", "content": _system_prompt(os_type)},
                {"role": "user", "content": _context_text(context)},
            ],
            "response_format": {"type": "json_object"},
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return parse_response(resp.json()["choices"][0]["message"]["content"])


def _call_anthropic(context: dict[str, Any], os_type: str, config: dict[str, Any], timeout: int) -> dict[str, Any]:
    api_key = config.get("api_key", "")
    if not api_key:
        logger.error("anthropic provider requires api_key in config")
        return dict(_FALLBACK)
    resp = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        json={
            "model": config["model"],
            "max_tokens": 1024,
            # System prompt in the dedicated system parameter; diff data in user message.
            "system": _system_prompt(os_type),
            "messages": [{"role": "user", "content": _context_text(context)}],
        },
        timeout=timeout,
    )
    resp.raise_for_status()
    return parse_response(resp.json()["content"][0]["text"])
