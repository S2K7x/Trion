"""Unit tests for core/collector.py."""
import subprocess
import sys
import os
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.collector import collect, validate_command


class TestValidateCommand(unittest.TestCase):

    def test_validate_command_clean(self):
        self.assertTrue(validate_command("ss -tlnp"))
        self.assertTrue(validate_command("cat /etc/passwd"))
        self.assertTrue(validate_command("netstat -ano"))

    def test_validate_command_injection(self):
        self.assertFalse(validate_command("cat /etc/passwd; rm -rf /"))
        self.assertFalse(validate_command("echo $(whoami)"))
        self.assertFalse(validate_command("cmd1 && cmd2"))
        self.assertFalse(validate_command("cmd `id`"))


class TestCollect(unittest.TestCase):

    def _make_proc(self, stdout="", returncode=0, stderr=""):
        proc = MagicMock()
        proc.stdout = stdout
        proc.returncode = returncode
        proc.stderr = stderr
        return proc

    @patch("core.collector.subprocess.run")
    def test_collect_successful_command(self, mock_run):
        mock_run.return_value = self._make_proc(stdout="output")
        result = collect("test-module", ["ss -tlnp"], "linux")
        self.assertIn("ss -tlnp", result)
        self.assertEqual(result["ss -tlnp"], "output")

    @patch("core.collector.subprocess.run")
    def test_collect_failed_command_no_crash(self, mock_run):
        mock_run.return_value = self._make_proc(stdout="", returncode=1, stderr="error")
        result = collect("test-module", ["bad-cmd"], "linux")
        self.assertIn("bad-cmd", result)
        self.assertEqual(result["bad-cmd"], "")

    @patch("core.collector.subprocess.run")
    def test_collect_timeout_no_crash(self, mock_run):
        mock_run.side_effect = subprocess.TimeoutExpired("cmd", 30)
        result = collect("test-module", ["slow-cmd"], "linux")
        self.assertIn("slow-cmd", result)
        self.assertEqual(result["slow-cmd"], "")

    @patch("core.collector.subprocess.run")
    def test_collect_validate_rejects_injection(self, mock_run):
        mock_run.return_value = self._make_proc(stdout="output")
        result = collect("test-module", ["cat /etc/passwd; rm -rf /"], "linux", validate=True)
        # Command should be present but empty (rejected, not executed)
        self.assertIn("cat /etc/passwd; rm -rf /", result)
        self.assertEqual(result["cat /etc/passwd; rm -rf /"], "")
        mock_run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
