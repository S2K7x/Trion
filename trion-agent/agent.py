#!/usr/bin/env python3
"""Trion Agent — daily host drift detection."""
import argparse
import importlib
import json
import logging
import logging.handlers
import os
import platform
import socket
import stat
import sys
import time
import traceback
import types
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any

try:
    import tomllib
except ImportError:
    try:
        import tomli as tomllib  # type: ignore[no-reattr,no-redef]
    except ImportError:
        print("ERROR: tomli not found. Run: pip install tomli", file=sys.stderr)
        sys.exit(1)

import schedule

from core import llm as llm_module
from core.collector import collect
from core.differ import diff
from core.notifier import notify, notify_agent_error, notify_webhook

_MODULE_MAP = {
    "config-drift": "modules.config_drift",
    "threat-detection": "modules.threat_detection",
}

_VERDICT_RANK = {"BENIGN": 0, "SUSPECT": 1, "CRITICAL": 2}


# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

class _AgentFormatter(logging.Formatter):
    """Uniform log format: TIMESTAMP [trion-agent] [module] LEVEL — message."""

    def format(self, record: logging.LogRecord) -> str:
        name = record.name
        if name in ("trion-agent", "root", "__main__"):
            record.shortname = "agent"
        else:
            record.shortname = name.split(".")[-1]
        return super().format(record)


def setup_logging(debug: bool = False) -> None:
    """Configure root logger with the uniform agent format."""
    handler = logging.StreamHandler()
    handler.setFormatter(
        _AgentFormatter(
            fmt="%(asctime)s [trion-agent] [%(shortname)s] %(levelname)s — %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(logging.DEBUG if debug else logging.INFO)


def setup_file_logging(log_path: str) -> None:
    """Add a rotating file handler so the dashboard can stream live logs."""
    try:
        Path(log_path).parent.mkdir(parents=True, exist_ok=True)
        handler = logging.handlers.RotatingFileHandler(
            log_path, maxBytes=500_000, backupCount=2, encoding="utf-8"
        )
        handler.setFormatter(
            _AgentFormatter(
                fmt="%(asctime)s [trion-agent] [%(shortname)s] %(levelname)s — %(message)s",
                datefmt="%Y-%m-%d %H:%M:%S",
            )
        )
        logging.getLogger().addHandler(handler)
    except OSError as exc:
        logger.warning("Could not open log file %s: %s", log_path, exc)


logger = logging.getLogger("trion-agent")


# ---------------------------------------------------------------------------
# Config & OS
# ---------------------------------------------------------------------------

def detect_os(cfg_os: str) -> str:
    """Resolve OS type from config or platform detection."""
    if cfg_os != "auto":
        return cfg_os.lower()
    system = platform.system()
    if system == "Linux":
        return "linux"
    if system == "Darwin":
        return "macos"
    if system == "Windows":
        return "windows"
    logger.warning("Unknown platform '%s', defaulting to linux", system)
    return "linux"


_REQUIRED_CFG: list[tuple[str, str]] = [
    ("agent", "modules"),
    ("llm", "provider"),
    ("llm", "model"),
]


def validate_config(config: dict[str, Any]) -> None:
    """Exit with a clear error if required config keys are missing."""
    for section, key in _REQUIRED_CFG:
        if key not in config.get(section, {}):
            logger.error("Missing required config key: [%s].%s", section, key)
            sys.exit(1)


def load_config(path: str = "config.toml") -> dict[str, Any]:
    """Load and return config from a TOML file."""
    config_path = Path(path)
    if not config_path.exists():
        logger.error("config.toml not found. Copy config.toml.example and edit it.")
        sys.exit(1)
    try:
        with open(config_path, "rb") as f:
            return tomllib.load(f)
    except tomllib.TOMLDecodeError as exc:
        logger.error("config.toml is malformed: %s", exc)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Baseline I/O
# ---------------------------------------------------------------------------

def load_baseline(baseline_path: str) -> dict[str, Any]:
    """Load baseline JSON.

    Returns empty dict on first run. On corruption, renames the file and
    returns empty dict (triggers a fresh first-run collection).
    """
    p = Path(baseline_path)
    if not p.exists():
        logger.info("No baseline found at %s — first run, will collect only.", baseline_path)
        return {}
    try:
        with open(p) as f:
            return json.load(f)
    except json.JSONDecodeError as exc:
        timestamp = datetime.now().strftime("%Y%m%dT%H%M%S")
        corrupted_path = p.with_name(f"baseline.corrupted.{timestamp}.json")
        try:
            p.rename(corrupted_path)
        except OSError:
            pass
        logger.error(
            "Baseline corrupted (%s) — renamed to %s, rebuilding from scratch.",
            exc,
            corrupted_path.name,
        )
        return {}
    except OSError as exc:
        logger.error("Cannot read baseline at %s: %s — will rebuild from scratch.", baseline_path, exc)
        return {}


def save_baseline(baseline_path: str, data: dict[str, Any]) -> None:
    """Atomically overwrite baseline JSON.

    Writes to a temp file then renames so a mid-write SIGKILL cannot leave
    a partially-written (corrupted) baseline on disk.
    """
    p = Path(baseline_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_suffix(".tmp")
    with open(tmp, "w") as f:
        json.dump(data, f, indent=2)
    tmp.replace(p)


def save_snapshot(snapshots_path: str, module_name: str, snapshot: dict[str, str]) -> None:
    """Write a dated snapshot for audit trail."""
    Path(snapshots_path).mkdir(parents=True, exist_ok=True)
    filename = (
        Path(snapshots_path)
        / f"{date.today()}_{module_name.replace('-', '_')}.json"
    )
    with open(filename, "w") as f:
        json.dump(snapshot, f, indent=2)


def save_last_run(data: dict[str, Any]) -> None:
    """Write data/last_run.json; silently ignore write failures."""
    try:
        Path("data").mkdir(parents=True, exist_ok=True)
        with open("data/last_run.json", "w") as f:
            json.dump(data, f, indent=2)
    except Exception as exc:
        logger.warning("Failed to write last_run.json: %s", exc)


def save_verdict(verdicts_dir: str, module_name: str, verdict: dict[str, Any]) -> None:
    """Persist LLM verdict JSON so the dashboard can show plain-English summaries."""
    try:
        Path(verdicts_dir).mkdir(parents=True, exist_ok=True)
        p = Path(verdicts_dir) / f"{date.today()}_{module_name.replace('-', '_')}.json"
        with open(p, "w") as f:
            json.dump(verdict, f, indent=2)
    except Exception as exc:
        logger.warning("Failed to write verdict for %s: %s", module_name, exc)


def append_run_history(history_path: str, entry: dict[str, Any]) -> None:
    """Append one JSONL line to run_history.jsonl for the dashboard chart."""
    try:
        Path(history_path).parent.mkdir(parents=True, exist_ok=True)
        with open(history_path, "a") as f:
            f.write(json.dumps(entry) + "\n")
    except Exception as exc:
        logger.warning("Failed to append run history: %s", exc)


# ---------------------------------------------------------------------------
# Snapshot retention cleanup
# ---------------------------------------------------------------------------

def cleanup_old_snapshots(snapshots_path: str, retention_days: int) -> None:
    """Delete snapshot files older than retention_days days."""
    sp = Path(snapshots_path)
    if not sp.exists():
        return
    cutoff = date.today() - timedelta(days=retention_days)
    cleaned = 0
    for f in sp.glob("*.json"):
        try:
            date_str = f.stem.split("_")[0]
            snap_date = date.fromisoformat(date_str)
            if snap_date < cutoff:
                f.unlink()
                cleaned += 1
        except Exception as exc:
            logger.warning("Snapshot cleanup skipped for %s: %s", f.name, exc)
    if cleaned:
        logger.info("Cleaned up %d old snapshot(s)", cleaned)


# ---------------------------------------------------------------------------
# Module helpers
# ---------------------------------------------------------------------------

def import_module(module_name: str) -> types.ModuleType | None:
    """Dynamically import a drift module by logical name."""
    dotted = _MODULE_MAP.get(module_name)
    if not dotted:
        logger.error("Unknown module: %s", module_name)
        return None
    return importlib.import_module(dotted)


def _worst_verdict(v1: str, v2: str) -> str:
    return v1 if _VERDICT_RANK.get(v1, 0) >= _VERDICT_RANK.get(v2, 0) else v2


# ---------------------------------------------------------------------------
# Dry-run display
# ---------------------------------------------------------------------------

def _print_dry_run(module_name: str, commands: list[str], snapshot: dict, diffs: list[dict]) -> None:
    """Print dry-run diff output in human-readable format."""
    diff_map = {d["command"]: d for d in diffs}
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M")
    print(f"\n=== DRY RUN — {now_str} ===")
    print(f"Module: {module_name}")
    for cmd in commands:
        print(f"  [{cmd}]")
        if cmd not in diff_map:
            print("    (no changes)")
            continue
        entry = diff_map[cmd]
        if entry["added"]:
            for line in entry["added"]:
                print(f"    + {line}")
        else:
            print("    + (nothing added)")
        if entry["removed"]:
            for line in entry["removed"]:
                print(f"    - {line}")
        else:
            print("    - (nothing removed)")
    print("=== END DRY RUN ===\n")


# ---------------------------------------------------------------------------
# Status display
# ---------------------------------------------------------------------------

def show_status(config: dict) -> None:
    """Print a one-page status summary to stdout."""
    agent_cfg = config.get("agent", {})
    llm_cfg = config.get("llm", {})
    notif_cfg = config.get("notifications", {})
    baseline_cfg = config.get("baseline", {})
    modules_cfg = config.get("modules", {})

    baseline_path = baseline_cfg.get("path", "data/baseline.json")
    snapshots_path = baseline_cfg.get("snapshots_path", "data/snapshots/")

    config_ok = Path("config.toml").exists()

    bp = Path(baseline_path)
    if bp.exists():
        mtime = datetime.fromtimestamp(bp.stat().st_mtime).strftime("%Y-%m-%d %H:%M")
        baseline_info = f"{baseline_path} (last updated: {mtime})"
    else:
        baseline_info = f"{baseline_path} (not found)"

    module_parts = []
    for m in agent_cfg.get("modules", []):
        enabled = modules_cfg.get(m, {}).get("enabled", True)
        module_parts.append(f"{m} {'✓' if enabled else '✗ (disabled)'}")
    modules_str = " | ".join(module_parts) if module_parts else "(none)"

    provider = llm_cfg.get("provider", "?")
    endpoint = llm_cfg.get("endpoint", "")
    model = llm_cfg.get("model", "?")
    base_llm_str = (
        f"{provider} @ {endpoint} (model: {model})"
        if endpoint
        else f"{provider} (model: {model})"
    )
    if provider == "ollama" and endpoint:
        reachable, latency = llm_module.check_ollama_connectivity(endpoint)
        connectivity = f"✓ reachable ({latency:.0f}ms)" if reachable else "✗ unreachable — see config.toml"
        llm_str = f"{base_llm_str} — {connectivity}"
    else:
        llm_str = base_llm_str

    webhook = notif_cfg.get("slack_webhook", "")
    slack_ok = bool(webhook) and not webhook.startswith("https://hooks.slack.com/services/YOUR")

    last_run_path = Path("data/last_run.json")
    if last_run_path.exists():
        try:
            with open(last_run_path) as f:
                last_run = json.load(f)
            last_run_str = f"{last_run.get('timestamp', '?')} — {last_run.get('verdict', '?')}"
        except Exception:
            last_run_str = "unreadable"
    else:
        last_run_str = "no run yet"

    sp = Path(snapshots_path)
    if sp.exists():
        snaps = sorted(sp.glob("*.json"))
        n_snaps = len(snaps)
        oldest = snaps[0].stem.split("_")[0] if snaps else "none"
        snap_str = f"{n_snaps} archived (oldest: {oldest})"
    else:
        snap_str = "0 archived"

    print(f"""
Trion Agent Status
  Config      : config.toml {'✓' if config_ok else '✗'}
  Baseline    : {baseline_info}
  Modules     : {modules_str}
  LLM         : {llm_str}
  Slack       : configured {'✓' if slack_ok else '✗'}
  Last run    : {last_run_str}
  Next run    : scheduled via systemd timer
  Snapshots   : {snap_str}
""".strip())


# ---------------------------------------------------------------------------
# Core run logic
# ---------------------------------------------------------------------------

def run_checks(config: dict[str, Any], os_type: str, dry_run: bool = False) -> None:
    """Orchestrate collect → diff → LLM → notify → update baseline for all enabled modules."""
    agent_cfg = config.get("agent", {})
    llm_cfg = dict(config.get("llm", {}))
    notif_cfg = config.get("notifications", {})
    baseline_cfg = config.get("baseline", {})

    baseline_path = baseline_cfg.get("path", "data/baseline.json")
    snapshots_path = baseline_cfg.get("snapshots_path", "data/snapshots/")
    verdicts_dir = baseline_cfg.get("verdicts_path", "data/verdicts/")
    history_path = baseline_cfg.get("history_path", "data/run_history.jsonl")
    retention_days = int(baseline_cfg.get("retention_days", 30))
    modules_cfg = config.get("modules", {})

    run_meta: dict[str, Any] = {
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "verdict": "BENIGN",
        "modules_run": [],
        "diffs_found": 0,
        "llm_called": False,
        "slack_sent": False,
        "error": None,
    }

    baseline = load_baseline(baseline_path)
    overall_verdict = "BENIGN"

    try:
        for module_name in agent_cfg.get("modules", []):
            mod = import_module(module_name)
            if mod is None:
                continue

            mod_settings = modules_cfg.get(module_name, {})
            if module_name not in modules_cfg:
                logger.warning(
                    "Module %s has no [modules.%s] config section — running with defaults.",
                    module_name, module_name,
                )
            if not mod_settings.get("enabled", True):
                logger.info("Module %s is disabled — skipping.", module_name)
                continue

            custom_commands = mod_settings.get("commands", [])
            ignore_patterns = mod_settings.get("ignore_patterns", [])
            commands = mod.get_commands(os_type, custom_commands)

            logger.info("Collecting snapshot for module: %s", module_name)
            snapshot = collect(module_name, commands, os_type, validate=bool(custom_commands))

            if not dry_run:
                save_snapshot(snapshots_path, module_name, snapshot)

            run_meta["modules_run"].append(module_name)

            if module_name not in baseline:
                if baseline:
                    # Existing baseline but this module is new
                    logger.info("Module %s not in baseline, initializing", module_name)
                else:
                    logger.info("First run — baseline set for %s. No diff computed.", module_name)
                if not dry_run:
                    baseline[module_name] = snapshot
                continue

            diffs = diff(baseline.get(module_name, {}), snapshot, ignore_patterns=ignore_patterns)

            if dry_run:
                _print_dry_run(module_name, commands, snapshot, diffs)
                continue

            if not diffs:
                logger.info("[%s] No changes detected.", module_name)
                baseline[module_name] = snapshot
            else:
                run_meta["diffs_found"] += len(diffs)
                logger.info("[%s] %d command(s) changed — sending to LLM.", module_name, len(diffs))
                llm_cfg["_module"] = module_name
                verdict = llm_module.analyze(diffs, llm_cfg, os_type)
                run_meta["llm_called"] = True
                logger.info(
                    "[%s] Verdict: %s (confidence=%s)",
                    module_name,
                    verdict.get("verdict"),
                    verdict.get("confidence"),
                )

                if verdict.get("llm_error"):
                    # LLM unavailable — keep old baseline for this module so next run re-diffs
                    logger.warning(
                        "[%s] LLM error — baseline NOT updated for this module.", module_name
                    )
                else:
                    baseline[module_name] = snapshot
                    save_verdict(verdicts_dir, module_name, verdict)

                sent = notify(verdict, notif_cfg, module_name)
                webhook_sent = notify_webhook(verdict, notif_cfg, module_name)
                if sent or webhook_sent:
                    run_meta["slack_sent"] = True

                overall_verdict = _worst_verdict(overall_verdict, verdict.get("verdict", "BENIGN"))

        if not dry_run:
            save_baseline(baseline_path, baseline)
            logger.info("Baseline updated at %s", baseline_path)
            cleanup_old_snapshots(snapshots_path, retention_days)

    except Exception as exc:
        run_meta["error"] = str(exc)
        logger.error("Unhandled exception in run_checks:\n%s", traceback.format_exc())
        notify_agent_error(notif_cfg, socket.gethostname(), run_meta["timestamp"])
        # Baseline is NOT saved — on-disk version stays intact
    finally:
        run_meta["verdict"] = overall_verdict
        if not dry_run:
            save_last_run(run_meta)
            append_run_history(
                history_path,
                {
                    "date": str(date.today()),
                    "timestamp": run_meta["timestamp"],
                    "verdict": overall_verdict,
                    "diffs_found": run_meta["diffs_found"],
                    "modules": run_meta["modules_run"],
                    "error": run_meta.get("error"),
                },
            )


# ---------------------------------------------------------------------------
# Data directory hardening
# ---------------------------------------------------------------------------

def _harden_data_dir(snapshots_path: str) -> None:
    """Restrict data/ to owner-only on Linux/macOS; no-op on Windows."""
    if platform.system() == "Windows":
        return
    try:
        data_dir = Path(snapshots_path).parent
        data_dir.mkdir(parents=True, exist_ok=True)
        data_dir.chmod(stat.S_IRWXU)
    except OSError as exc:
        logger.warning("Could not set permissions on data/: %s", exc)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Trion Agent — daily host drift detection",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "Examples:\n"
            "  python3 agent.py --run-now\n"
            "  python3 agent.py --dry-run\n"
            "  python3 agent.py --status\n"
            "  python3 agent.py --debug --run-now"
        ),
    )
    parser.add_argument(
        "--run-now",
        action="store_true",
        help="Run checks immediately and exit (bypass scheduler)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Collect and diff, print results, skip LLM/Slack/baseline update",
    )
    parser.add_argument(
        "--status",
        action="store_true",
        help="Print agent status and exit",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable DEBUG logging",
    )
    parser.add_argument(
        "--config",
        default="config.toml",
        help="Path to config file (default: config.toml)",
    )
    parser.add_argument(
        "--reset-baseline",
        action="store_true",
        help="Delete the stored baseline and exit (next run rebuilds from scratch)",
    )
    args = parser.parse_args()

    setup_logging(debug=args.debug)

    # Resolve working directory to the agent's own directory so relative paths work
    agent_dir = Path(__file__).parent
    os.chdir(agent_dir)

    config = load_config(args.config)
    validate_config(config)
    setup_file_logging("data/agent.log")
    os_type = detect_os(config.get("agent", {}).get("os", "auto"))

    if args.status:
        show_status(config)
        return

    if args.reset_baseline:
        baseline_path = config.get("baseline", {}).get("path", "data/baseline.json")
        p = Path(baseline_path)
        if p.exists():
            p.unlink()
            logger.info("Baseline deleted at %s — next run will build fresh.", baseline_path)
        else:
            logger.info("No baseline found at %s — nothing to reset.", baseline_path)
        return

    logger.info("OS detected: %s", os_type)

    baseline_cfg = config.get("baseline", {})
    snapshots_path = baseline_cfg.get("snapshots_path", "data/snapshots/")
    _harden_data_dir(snapshots_path)

    if args.dry_run:
        logger.info("[DRY RUN] Starting dry run — no LLM, no Slack, no baseline update.")
        run_checks(config, os_type, dry_run=True)
        logger.info("[DRY RUN] Done.")
        return

    if args.run_now:
        logger.info("--run-now flag set, executing checks immediately.")
        run_checks(config, os_type)
        return

    schedule_time = config.get("agent", {}).get("schedule", "07:00")
    logger.info("Scheduling daily checks at %s", schedule_time)
    schedule.every().day.at(schedule_time).do(run_checks, config=config, os_type=os_type)

    logger.info("Trion Agent running. Waiting for scheduled time...")
    while True:
        schedule.run_pending()
        time.sleep(60)


if __name__ == "__main__":
    main()
