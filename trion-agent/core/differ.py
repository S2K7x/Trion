"""Diff a baseline snapshot against a new snapshot."""
import logging
import re
from typing import Any

logger = logging.getLogger(__name__)


def _normalize(value: Any) -> str:
    """Normalize command output: None, empty, and whitespace-only all become ''."""
    if value is None:
        return ""
    s = str(value)
    return "" if s.strip() == "" else s


def diff(
    baseline_module: dict[str, str],
    snapshot_module: dict[str, str],
    ignore_patterns: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Compare baseline and snapshot line-by-line per command.

    - Commands only in snapshot (new command added to config): added=all lines, removed=[].
    - Commands only in baseline (command removed from config): silently skipped.
    - Commands on both sides: diff their lines; entries with no changes are excluded.
    - Lines matching any pattern in ignore_patterns are excluded from both sides.
    """
    compiled: list[re.Pattern[str]] = []
    for pattern in (ignore_patterns or []):
        try:
            compiled.append(re.compile(pattern))
        except re.error as exc:
            logger.warning("Invalid ignore_pattern %r — skipped: %s", pattern, exc)

    def _ignored(line: str) -> bool:
        return any(p.search(line) for p in compiled)

    results = []

    for cmd in snapshot_module.keys():
        new_raw = _normalize(snapshot_module.get(cmd))
        new_lines = set(new_raw.splitlines()) if new_raw else set()

        if cmd not in baseline_module:
            # New command — treat all its output as added
            if new_lines:
                logger.info("New command in baseline: %s", cmd)
                results.append({"command": cmd, "added": sorted(new_lines), "removed": []})
            continue

        old_raw = _normalize(baseline_module.get(cmd))
        old_lines = set(old_raw.splitlines()) if old_raw else set()

        # Apply ignore patterns to both sides before computing the diff
        if compiled:
            new_lines = {l for l in new_lines if not _ignored(l)}
            old_lines = {l for l in old_lines if not _ignored(l)}

        added = sorted(new_lines - old_lines)
        removed = sorted(old_lines - new_lines)

        if added or removed:
            results.append({"command": cmd, "added": added, "removed": removed})

    unchanged = len(snapshot_module) - len(results)
    if results:
        logger.info("%d diff(s) found, %d command(s) unchanged", len(results), unchanged)

    return results
