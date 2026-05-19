"""Send Slack notifications for drift verdicts."""
import logging
import socket
from datetime import date

import requests

logger = logging.getLogger(__name__)


def _get_webhook(config: dict) -> str | None:
    """Return the webhook URL if configured, None otherwise."""
    webhook = config.get("slack_webhook", "")
    if not webhook or webhook.startswith("https://hooks.slack.com/services/YOUR"):
        return None
    return webhook


def notify(verdict_json: dict, config: dict, module_name: str) -> bool:
    """Post a Slack message if the verdict warrants a notification.

    Returns True if a message was sent.
    """
    verdict = verdict_json.get("verdict", "BENIGN")
    notify_on = config.get("notify_on", ["SUSPECT", "CRITICAL"])

    if verdict == "BENIGN":
        return False
    if verdict not in notify_on:
        return False

    webhook = _get_webhook(config)
    if not webhook:
        logger.warning("Slack webhook not configured — skipping notification")
        return False

    hostname = socket.gethostname()
    today = str(date.today())
    confidence = verdict_json.get("confidence", 0)
    changes = verdict_json.get("changes", [])
    llm_error = verdict_json.get("llm_error", False)

    changes_list = "\n".join(
        f"• {c.get('item', '?')} — {c.get('reason', '')}"
        for c in changes
    )

    if verdict == "CRITICAL":
        text = (
            f"🔴 *CRITICAL* — {hostname}\n"
            f"Module: {module_name} | {today}\n\n"
            f"{changes_list}\n\n"
            f"Confidence: {confidence}% | <!channel>"
        )
    else:
        text = (
            f"🟡 *SUSPECT* — {hostname}\n"
            f"Module: {module_name} | {today}\n\n"
            f"{changes_list}\n\n"
            f"Confidence: {confidence}%"
        )

    if llm_error:
        text += "\n⚠️ LLM unavailable — verdict is a precautionary SUSPECT"

    try:
        resp = requests.post(webhook, json={"text": text}, timeout=10)
        resp.raise_for_status()
        logger.info("Slack notification sent (%s)", verdict)
        return True
    except requests.RequestException as exc:
        logger.error("Slack notification failed: %s", exc)
        return False


def notify_agent_error(config: dict, hostname: str, timestamp: str) -> None:
    """Send a Slack error notification when a run fails unexpectedly."""
    webhook = _get_webhook(config)
    if not webhook:
        return
    text = (
        f"🔴 Trion Agent Error — {hostname}\n"
        f"Run failed at {timestamp}.\n"
        f"Baseline not updated. Check agent logs."
    )
    try:
        resp = requests.post(webhook, json={"text": text}, timeout=10)
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.error("Failed to send agent error to Slack: %s", exc)
