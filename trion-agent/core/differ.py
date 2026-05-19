"""Diff a baseline snapshot against a new snapshot."""
import logging

logger = logging.getLogger(__name__)


def _normalize(value) -> str:
    """Normalize command output: None, empty, and whitespace-only all become ''."""
    if value is None:
        return ""
    s = str(value)
    return "" if s.strip() == "" else s


def diff(baseline_module: dict[str, str], snapshot_module: dict[str, str]) -> list[dict]:
    """Compare baseline and snapshot line-by-line per command.

    - Commands only in snapshot (new command added to config): added=all lines, removed=[].
    - Commands only in baseline (command removed from config): silently skipped.
    - Commands on both sides: diff their lines; entries with no changes are excluded.
    """
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

        added = sorted(new_lines - old_lines)
        removed = sorted(old_lines - new_lines)

        if added or removed:
            results.append({"command": cmd, "added": added, "removed": removed})

    unchanged = len(snapshot_module) - len(results)
    if results:
        logger.info("%d diff(s) found, %d command(s) unchanged", len(results), unchanged)

    return results
