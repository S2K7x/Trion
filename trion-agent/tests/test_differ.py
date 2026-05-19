"""Unit tests for core/differ.py."""
import sys
import os
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.differ import diff


class TestDiffer(unittest.TestCase):

    def test_no_changes(self):
        result = diff({"cmd1": "line1\nline2"}, {"cmd1": "line1\nline2"})
        self.assertEqual(result, [])

    def test_added_line(self):
        result = diff({"cmd1": "line1"}, {"cmd1": "line1\nline2"})
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["added"], ["line2"])
        self.assertEqual(result[0]["removed"], [])

    def test_removed_line(self):
        result = diff({"cmd1": "line1\nline2"}, {"cmd1": "line1"})
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["added"], [])
        self.assertEqual(result[0]["removed"], ["line2"])

    def test_empty_output(self):
        result = diff({"cmd1": ""}, {"cmd1": ""})
        self.assertEqual(result, [])

    def test_none_output(self):
        result = diff({"cmd1": None}, {"cmd1": None})
        self.assertEqual(result, [])

    def test_whitespace_only(self):
        result = diff({"cmd1": "\n\n  \n"}, {"cmd1": "\n\n  \n"})
        self.assertEqual(result, [])

    def test_new_command_in_snapshot(self):
        result = diff({}, {"cmd1": "line1\nline2"})
        self.assertEqual(len(result), 1)
        self.assertIn("line1", result[0]["added"])
        self.assertIn("line2", result[0]["added"])
        self.assertEqual(result[0]["removed"], [])

    def test_removed_command_silent(self):
        result = diff({"cmd1": "line1"}, {})
        self.assertEqual(result, [])

    def test_multiple_commands_partial_change(self):
        baseline = {"cmd1": "a", "cmd2": "x\ny"}
        snapshot = {"cmd1": "a", "cmd2": "x\ny\nz"}
        result = diff(baseline, snapshot)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["command"], "cmd2")
        self.assertEqual(result[0]["added"], ["z"])
        self.assertEqual(result[0]["removed"], [])


if __name__ == "__main__":
    unittest.main()
