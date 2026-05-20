"""Unit tests for core/llm.py."""
import json
import os
import sys
import unittest
from unittest.mock import MagicMock, patch

import requests

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.llm import analyze, build_prompt

_OLLAMA_CONFIG = {
    "provider": "ollama",
    "model": "llama3.2",
    "endpoint": "http://localhost:11434",
    "timeout": 30,
    "_module": "config-drift",
}

_SAMPLE_DIFFS = [
    {"command": "ss -tlnp", "added": ["LISTEN 0.0.0.0:4444"], "removed": []}
]


def _make_ollama_response(verdict_json: dict) -> MagicMock:
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"response": json.dumps(verdict_json)}
    mock_resp.raise_for_status.return_value = None
    return mock_resp


class TestLLMAnalyze(unittest.TestCase):

    @patch("core.llm.requests.post")
    def test_ollama_success(self, mock_post):
        payload = {"verdict": "BENIGN", "confidence": 90, "changes": [], "summary": "All good"}
        mock_post.return_value = _make_ollama_response(payload)
        result = analyze(_SAMPLE_DIFFS, _OLLAMA_CONFIG, "linux")
        self.assertEqual(result["verdict"], "BENIGN")
        self.assertEqual(result["confidence"], 90)
        self.assertNotIn("llm_error", result)

    @patch("core.llm.requests.post")
    def test_timeout_returns_suspect(self, mock_post):
        mock_post.side_effect = requests.Timeout()
        result = analyze(_SAMPLE_DIFFS, _OLLAMA_CONFIG, "linux")
        self.assertEqual(result["verdict"], "SUSPECT")
        self.assertTrue(result.get("llm_error"))

    @patch("core.llm.requests.post")
    def test_connection_error_returns_suspect(self, mock_post):
        mock_post.side_effect = requests.ConnectionError()
        result = analyze(_SAMPLE_DIFFS, _OLLAMA_CONFIG, "linux")
        self.assertEqual(result["verdict"], "SUSPECT")
        self.assertTrue(result.get("llm_error"))

    @patch("core.llm.requests.post")
    def test_malformed_json_returns_suspect(self, mock_post):
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"response": "not valid json"}
        mock_resp.raise_for_status.return_value = None
        mock_post.return_value = mock_resp
        result = analyze(_SAMPLE_DIFFS, _OLLAMA_CONFIG, "linux")
        self.assertEqual(result["verdict"], "SUSPECT")
        self.assertTrue(result.get("llm_error"))

    def test_context_truncation(self):
        # Build a diff with 100 added lines to force truncation
        large_diffs = [
            {
                "command": "ss -tlnp",
                "added": [f"line_{i}" for i in range(100)],
                "removed": [f"old_{i}" for i in range(100)],
            }
        ]
        context = {
            "host": "testhost",
            "os": "linux",
            "date": "2026-05-19",
            "module": "config-drift",
            "diffs": large_diffs,
        }
        prompt = build_prompt(context, "linux")
        # Even the raw prompt from a large context should be manageable —
        # verify truncation kicks in when analyze() processes it
        self.assertIsInstance(prompt, str)
        self.assertGreater(len(prompt), 0)

        # Verify _truncate_context caps at 50 lines per side
        from core.llm import _truncate_context
        truncated = _truncate_context(context)
        for d in truncated["diffs"]:
            self.assertLessEqual(len(d.get("added", [])), 50)
            self.assertLessEqual(len(d.get("removed", [])), 50)


if __name__ == "__main__":
    unittest.main()
