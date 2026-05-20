"""Unit tests for core/notifier.py."""
import sys
import os
import unittest
from unittest.mock import patch, MagicMock

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.notifier import notify, notify_agent_error

_WEBHOOK_CFG = {"slack_webhook": "https://hooks.slack.com/services/T/B/REAL", "notify_on": ["SUSPECT", "CRITICAL"]}
_NO_WEBHOOK_CFG = {"slack_webhook": "", "notify_on": ["SUSPECT", "CRITICAL"]}
_PLACEHOLDER_CFG = {"slack_webhook": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL", "notify_on": ["SUSPECT", "CRITICAL"]}
_CRITICAL_ONLY_CFG = {"slack_webhook": "https://hooks.slack.com/services/T/B/REAL", "notify_on": ["CRITICAL"]}


def _make_resp(status_code=200):
    mock = MagicMock()
    mock.status_code = status_code
    mock.headers = {}
    mock.raise_for_status.return_value = None if status_code < 400 else (_ for _ in ()).throw(
        requests.HTTPError(response=mock)
    )
    return mock


class TestNotifyBenign(unittest.TestCase):
    @patch("core.notifier.requests.post")
    def test_benign_no_notification(self, mock_post):
        verdict = {"verdict": "BENIGN", "confidence": 95, "changes": []}
        result = notify(verdict, _WEBHOOK_CFG, "config-drift")
        self.assertFalse(result)
        mock_post.assert_not_called()

    @patch("core.notifier.requests.post")
    def test_benign_with_llm_error_does_notify(self, mock_post):
        """LLM error on a non-BENIGN starting point must always notify."""
        mock_post.return_value = _make_resp(200)
        verdict = {"verdict": "SUSPECT", "confidence": 0, "changes": [], "llm_error": True}
        result = notify(verdict, _WEBHOOK_CFG, "config-drift")
        self.assertTrue(result)
        mock_post.assert_called_once()


class TestNotifySuspect(unittest.TestCase):
    @patch("core.notifier.requests.post")
    def test_suspect_sends_notification(self, mock_post):
        mock_post.return_value = _make_resp(200)
        verdict = {"verdict": "SUSPECT", "confidence": 65, "changes": [{"item": "new port", "reason": "unusual"}]}
        result = notify(verdict, _WEBHOOK_CFG, "config-drift")
        self.assertTrue(result)
        mock_post.assert_called_once()
        payload = mock_post.call_args.kwargs["json"]
        self.assertIn("SUSPECT", payload["text"])
        self.assertIn("new port", payload["text"])

    @patch("core.notifier.requests.post")
    def test_suspect_excluded_by_notify_on_no_llm_error(self, mock_post):
        """If notify_on is CRITICAL only and no llm_error, SUSPECT is suppressed."""
        verdict = {"verdict": "SUSPECT", "confidence": 65, "changes": []}
        result = notify(verdict, _CRITICAL_ONLY_CFG, "config-drift")
        self.assertFalse(result)
        mock_post.assert_not_called()

    @patch("core.notifier.requests.post")
    def test_suspect_with_llm_error_always_notifies(self, mock_post):
        """llm_error bypasses notify_on filter."""
        mock_post.return_value = _make_resp(200)
        verdict = {"verdict": "SUSPECT", "confidence": 0, "changes": [], "llm_error": True}
        result = notify(verdict, _CRITICAL_ONLY_CFG, "config-drift")
        self.assertTrue(result)
        mock_post.assert_called_once()
        payload = mock_post.call_args.kwargs["json"]
        self.assertIn("LLM unavailable", payload["text"])


class TestNotifyCritical(unittest.TestCase):
    @patch("core.notifier.requests.post")
    def test_critical_sends_notification_with_channel_mention(self, mock_post):
        mock_post.return_value = _make_resp(200)
        verdict = {"verdict": "CRITICAL", "confidence": 92, "changes": [{"item": "root shell", "reason": "bad"}]}
        result = notify(verdict, _WEBHOOK_CFG, "config-drift")
        self.assertTrue(result)
        payload = mock_post.call_args.kwargs["json"]
        self.assertIn("CRITICAL", payload["text"])
        self.assertIn("<!channel>", payload["text"])


class TestNotifyWebhookMissing(unittest.TestCase):
    @patch("core.notifier.requests.post")
    def test_no_webhook_configured(self, mock_post):
        verdict = {"verdict": "CRITICAL", "confidence": 90, "changes": []}
        result = notify(verdict, _NO_WEBHOOK_CFG, "config-drift")
        self.assertFalse(result)
        mock_post.assert_not_called()

    @patch("core.notifier.requests.post")
    def test_placeholder_webhook_treated_as_unconfigured(self, mock_post):
        verdict = {"verdict": "CRITICAL", "confidence": 90, "changes": []}
        result = notify(verdict, _PLACEHOLDER_CFG, "config-drift")
        self.assertFalse(result)
        mock_post.assert_not_called()


class TestNotifyRequestFailure(unittest.TestCase):
    @patch("core.notifier.requests.post")
    def test_request_exception_returns_false(self, mock_post):
        mock_post.side_effect = requests.ConnectionError("unreachable")
        verdict = {"verdict": "CRITICAL", "confidence": 90, "changes": []}
        result = notify(verdict, _WEBHOOK_CFG, "config-drift")
        self.assertFalse(result)

    @patch("core.notifier.time.sleep")
    @patch("core.notifier.requests.post")
    def test_rate_limit_429_retries(self, mock_post, mock_sleep):
        rate_limited = MagicMock()
        rate_limited.status_code = 429
        rate_limited.headers = {"Retry-After": "1"}
        rate_limited.raise_for_status.return_value = None
        ok = _make_resp(200)
        mock_post.side_effect = [rate_limited, ok]
        verdict = {"verdict": "SUSPECT", "confidence": 70, "changes": []}
        result = notify(verdict, _WEBHOOK_CFG, "config-drift")
        self.assertTrue(result)
        self.assertEqual(mock_post.call_count, 2)
        mock_sleep.assert_called_once_with(1)


class TestNotifyAgentError(unittest.TestCase):
    @patch("core.notifier.requests.post")
    def test_agent_error_sends_message(self, mock_post):
        mock_post.return_value = _make_resp(200)
        notify_agent_error(_WEBHOOK_CFG, "myhost", "2026-05-20T07:00:00")
        mock_post.assert_called_once()
        payload = mock_post.call_args.kwargs["json"]
        self.assertIn("Trion Agent Error", payload["text"])
        self.assertIn("myhost", payload["text"])

    @patch("core.notifier.requests.post")
    def test_agent_error_no_webhook_silent(self, mock_post):
        notify_agent_error(_NO_WEBHOOK_CFG, "myhost", "2026-05-20T07:00:00")
        mock_post.assert_not_called()


if __name__ == "__main__":
    unittest.main()
