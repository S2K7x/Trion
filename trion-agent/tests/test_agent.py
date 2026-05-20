"""Unit tests for agent.py orchestration logic."""
import json
import os
import sys
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import agent


class TestLoadBaseline(unittest.TestCase):
    def test_first_run_returns_empty(self):
        with tempfile.TemporaryDirectory() as d:
            result = agent.load_baseline(os.path.join(d, "baseline.json"))
            self.assertEqual(result, {})

    def test_valid_baseline_loaded(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "baseline.json"
            data = {"config-drift": {"ss -tlnp": "output"}}
            p.write_text(json.dumps(data))
            result = agent.load_baseline(str(p))
            self.assertEqual(result, data)

    def test_corrupted_baseline_renamed_returns_empty(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "baseline.json"
            p.write_text("{not valid json")
            result = agent.load_baseline(str(p))
            self.assertEqual(result, {})
            self.assertFalse(p.exists(), "Corrupted baseline should be renamed")
            corrupted = list(Path(d).glob("baseline.corrupted.*.json"))
            self.assertEqual(len(corrupted), 1)

    @unittest.skipIf(os.getuid() == 0, "permission check not meaningful as root")
    def test_permission_error_returns_empty(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "baseline.json"
            p.write_text('{"config-drift": {}}')
            p.chmod(0o000)
            try:
                result = agent.load_baseline(str(p))
                self.assertEqual(result, {})
            finally:
                p.chmod(0o644)


class TestSaveBaseline(unittest.TestCase):
    def test_atomic_write(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "baseline.json")
            data = {"config-drift": {"cmd": "out"}}
            agent.save_baseline(p, data)
            loaded = json.loads(Path(p).read_text())
            self.assertEqual(loaded, data)

    def test_no_tmp_file_left_behind(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "baseline.json")
            agent.save_baseline(p, {})
            tmp = Path(p).with_suffix(".tmp")
            self.assertFalse(tmp.exists(), ".tmp file should be cleaned up after atomic write")

    def test_creates_parent_dirs(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, "nested", "deep", "baseline.json")
            agent.save_baseline(p, {"x": 1})
            self.assertTrue(Path(p).exists())


class TestCleanupOldSnapshots(unittest.TestCase):
    def test_old_snapshot_deleted(self):
        with tempfile.TemporaryDirectory() as d:
            old = Path(d) / "2020-01-01_config_drift.json"
            old.write_text("{}")
            agent.cleanup_old_snapshots(d, retention_days=30)
            self.assertFalse(old.exists())

    def test_recent_snapshot_kept(self):
        with tempfile.TemporaryDirectory() as d:
            today = datetime.now().strftime("%Y-%m-%d")
            recent = Path(d) / f"{today}_config_drift.json"
            recent.write_text("{}")
            agent.cleanup_old_snapshots(d, retention_days=30)
            self.assertTrue(recent.exists())

    def test_nonexistent_path_is_noop(self):
        agent.cleanup_old_snapshots("/nonexistent/path", retention_days=30)


class TestRunChecksDryRun(unittest.TestCase):
    """Verify --dry-run produces no file writes or network calls."""

    def _minimal_config(self, tmpdir: str) -> dict:
        return {
            "agent": {"modules": ["config-drift"], "os": "linux"},
            "llm": {"provider": "ollama", "model": "llama3.2", "endpoint": "http://localhost:11434", "timeout": 30},
            "notifications": {"slack_webhook": "https://hooks.slack.com/services/T/B/REAL", "notify_on": ["SUSPECT", "CRITICAL"]},
            "baseline": {"path": os.path.join(tmpdir, "baseline.json"), "snapshots_path": os.path.join(tmpdir, "snapshots/"), "retention_days": 30},
            "modules": {"config-drift": {"enabled": True, "commands": []}},
        }

    @patch("core.notifier.requests.post")
    @patch("core.llm.requests.post")
    @patch("core.collector.subprocess.run")
    def test_dry_run_no_baseline_written(self, mock_run, mock_llm, mock_slack):
        mock_run.return_value = MagicMock(stdout="output", returncode=0, stderr="")
        with tempfile.TemporaryDirectory() as d:
            cfg = self._minimal_config(d)
            baseline_path = cfg["baseline"]["path"]
            agent.run_checks(cfg, "linux", dry_run=True)
            self.assertFalse(Path(baseline_path).exists(), "dry-run must not write baseline")
            mock_llm.assert_not_called()
            mock_slack.assert_not_called()

    @patch("core.notifier.requests.post")
    @patch("core.llm.requests.post")
    @patch("core.collector.subprocess.run")
    def test_dry_run_no_last_run_written(self, mock_run, mock_llm, mock_slack):
        mock_run.return_value = MagicMock(stdout="output", returncode=0, stderr="")
        with tempfile.TemporaryDirectory() as d:
            cfg = self._minimal_config(d)
            agent.run_checks(cfg, "linux", dry_run=True)
            self.assertFalse((Path(d) / "last_run.json").exists())


class TestRunChecksNoDiff(unittest.TestCase):
    """Empty diff → no LLM call, no Slack, baseline updated."""

    @patch("core.notifier.requests.post")
    @patch("core.llm.requests.post")
    @patch("core.collector.subprocess.run")
    def test_no_diff_silent(self, mock_run, mock_llm, mock_slack):
        mock_run.return_value = MagicMock(stdout="same output", returncode=0, stderr="")
        with tempfile.TemporaryDirectory() as d:
            baseline_path = os.path.join(d, "baseline.json")
            snapshots_path = os.path.join(d, "snapshots/")
            # Pre-populate baseline with same output so diff is empty
            existing = {
                "config-drift": {
                    cmd: "same output"
                    for cmd in ["ss -tlnp", "systemctl list-units --state=running --no-pager",
                                "cat /etc/passwd", "cat /etc/sudoers", "crontab -l", "ls -la /etc/cron.d/"]
                }
            }
            agent.save_baseline(baseline_path, existing)
            cfg = {
                "agent": {"modules": ["config-drift"]},
                "llm": {"provider": "ollama", "model": "llama3.2", "endpoint": "http://localhost:11434", "timeout": 30},
                "notifications": {"slack_webhook": "", "notify_on": ["SUSPECT", "CRITICAL"]},
                "baseline": {"path": baseline_path, "snapshots_path": snapshots_path, "retention_days": 30},
                "modules": {"config-drift": {"enabled": True, "commands": []}},
            }
            agent.run_checks(cfg, "linux", dry_run=False)
            mock_llm.assert_not_called()
            mock_slack.assert_not_called()


class TestRunChecksFirstRun(unittest.TestCase):
    """First run (no baseline) → collect, save baseline, no LLM, no Slack."""

    @patch("core.notifier.requests.post")
    @patch("core.llm.requests.post")
    @patch("core.collector.subprocess.run")
    def test_first_run_no_alert(self, mock_run, mock_llm, mock_slack):
        mock_run.return_value = MagicMock(stdout="output", returncode=0, stderr="")
        with tempfile.TemporaryDirectory() as d:
            baseline_path = os.path.join(d, "baseline.json")
            snapshots_path = os.path.join(d, "snapshots/")
            cfg = {
                "agent": {"modules": ["config-drift"]},
                "llm": {"provider": "ollama", "model": "llama3.2", "endpoint": "http://localhost:11434", "timeout": 30},
                "notifications": {"slack_webhook": "", "notify_on": ["SUSPECT", "CRITICAL"]},
                "baseline": {"path": baseline_path, "snapshots_path": snapshots_path, "retention_days": 30},
                "modules": {"config-drift": {"enabled": True, "commands": []}},
            }
            agent.run_checks(cfg, "linux", dry_run=False)
            mock_llm.assert_not_called()
            mock_slack.assert_not_called()
            self.assertTrue(Path(baseline_path).exists(), "Baseline should be written after first run")


class TestRunChecksWithDiff(unittest.TestCase):
    """Non-empty diff → LLM called; BENIGN → no Slack; SUSPECT → Slack sent.

    Mock at the llm.analyze boundary so integration tests stay independent of
    the internal HTTP transport of the LLM module (already covered in test_llm.py).
    """

    def _cfg(self, tmpdir, baseline_data):
        baseline_path = os.path.join(tmpdir, "baseline.json")
        agent.save_baseline(baseline_path, baseline_data)
        return {
            "agent": {"modules": ["config-drift"]},
            "llm": {"provider": "ollama", "model": "llama3.2", "endpoint": "http://localhost:11434", "timeout": 30},
            "notifications": {"slack_webhook": "https://hooks.slack.com/services/T/B/REAL", "notify_on": ["SUSPECT", "CRITICAL"]},
            "baseline": {"path": baseline_path, "snapshots_path": os.path.join(tmpdir, "snapshots/"), "retention_days": 30},
            "modules": {"config-drift": {"enabled": True, "commands": ["echo hello"]}},
        }

    @patch("core.notifier.requests.post")
    @patch("core.llm.analyze")
    @patch("core.collector.subprocess.run")
    def test_diff_benign_no_slack(self, mock_run, mock_analyze, mock_slack):
        mock_run.return_value = MagicMock(stdout="new output", returncode=0, stderr="")
        mock_analyze.return_value = {
            "verdict": "BENIGN", "confidence": 95, "changes": [], "summary": "ok"
        }
        with tempfile.TemporaryDirectory() as d:
            cfg = self._cfg(d, {"config-drift": {"echo hello": "old output"}})
            agent.run_checks(cfg, "linux", dry_run=False)
            mock_analyze.assert_called_once()
            mock_slack.assert_not_called()

    @patch("core.notifier.requests.post")
    @patch("core.llm.analyze")
    @patch("core.collector.subprocess.run")
    def test_diff_suspect_sends_slack(self, mock_run, mock_analyze, mock_slack):
        mock_run.return_value = MagicMock(stdout="new output", returncode=0, stderr="")
        mock_analyze.return_value = {
            "verdict": "SUSPECT", "confidence": 70,
            "changes": [{"item": "new port 4444", "reason": "unusual"}], "summary": "sus",
        }
        slack_resp = MagicMock()
        slack_resp.status_code = 200
        slack_resp.headers = {}
        slack_resp.raise_for_status.return_value = None
        mock_slack.return_value = slack_resp

        with tempfile.TemporaryDirectory() as d:
            cfg = self._cfg(d, {"config-drift": {"echo hello": "old output"}})
            agent.run_checks(cfg, "linux", dry_run=False)
            mock_analyze.assert_called_once()
            mock_slack.assert_called_once()


class TestRunChecksDisabledModule(unittest.TestCase):
    @patch("core.collector.subprocess.run")
    def test_disabled_module_skipped(self, mock_run):
        with tempfile.TemporaryDirectory() as d:
            cfg = {
                "agent": {"modules": ["config-drift"]},
                "llm": {"provider": "ollama", "model": "llama3.2", "endpoint": "http://localhost:11434", "timeout": 30},
                "notifications": {"slack_webhook": "", "notify_on": ["SUSPECT", "CRITICAL"]},
                "baseline": {"path": os.path.join(d, "baseline.json"), "snapshots_path": os.path.join(d, "snapshots/"), "retention_days": 30},
                "modules": {"config-drift": {"enabled": False, "commands": []}},
            }
            agent.run_checks(cfg, "linux", dry_run=False)
            mock_run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
