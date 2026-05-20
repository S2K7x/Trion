#!/usr/bin/env python3
"""Trion Agent — self-hosted web dashboard."""
from __future__ import annotations

import asyncio
import json
import logging
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

try:
    import tomllib
except ImportError:
    import tomli as tomllib  # type: ignore[no-reattr,no-redef]

import aiofiles
import tomli_w
import uvicorn
from fastapi import FastAPI, Form, Request, Response
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from jose import JWTError, jwt

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

AGENT_DIR = Path(__file__).parent
CONFIG_PATH = AGENT_DIR / "config.toml"
TEMPLATES_DIR = AGENT_DIR / "ui" / "templates"
STATIC_DIR = AGENT_DIR / "ui" / "static"

logging.basicConfig(level=logging.INFO, format="%(asctime)s [ui] %(levelname)s — %(message)s")
logger = logging.getLogger("trion-ui")

# ---------------------------------------------------------------------------
# Config helpers
# ---------------------------------------------------------------------------

def load_config() -> dict[str, Any]:
    if not CONFIG_PATH.exists():
        logger.error("config.toml not found — run agent first and configure it.")
        sys.exit(1)
    with open(CONFIG_PATH, "rb") as f:
        return tomllib.load(f)


def save_config(config: dict[str, Any]) -> None:
    """Atomically write config.toml."""
    tmp = CONFIG_PATH.with_suffix(".tmp")
    with open(tmp, "wb") as f:
        tomli_w.dump(config, f)
    tmp.replace(CONFIG_PATH)


def _ui_cfg() -> dict[str, Any]:
    return load_config().get("ui", {})


def _jwt_secret() -> str:
    return _ui_cfg().get("secret", "change-this-secret-please-use-32-chars")


def _ui_password() -> str:
    return _ui_cfg().get("password", "changeme")


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

_COOKIE = "trion_ui_session"
_ALGORITHM = "HS256"


def _make_token() -> str:
    exp = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode({"exp": exp, "sub": "dashboard"}, _jwt_secret(), algorithm=_ALGORITHM)


def _verify_token(token: str | None) -> bool:
    if not token:
        return False
    try:
        jwt.decode(token, _jwt_secret(), algorithms=[_ALGORITHM])
        return True
    except JWTError:
        return False


def _require_auth(request: Request) -> bool:
    return _verify_token(request.cookies.get(_COOKIE))


# ---------------------------------------------------------------------------
# Data helpers
# ---------------------------------------------------------------------------

def _last_run() -> dict[str, Any]:
    p = AGENT_DIR / "data" / "last_run.json"
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text())
    except Exception:
        return {}


def _baseline_exists() -> bool:
    cfg = load_config()
    bp = AGENT_DIR / cfg.get("baseline", {}).get("path", "data/baseline.json")
    return bp.exists()


def _snapshots_dir() -> Path:
    cfg = load_config()
    return AGENT_DIR / cfg.get("baseline", {}).get("snapshots_path", "data/snapshots/")


def _list_snapshot_dates() -> list[dict[str, Any]]:
    """Return list of {date, modules} dicts sorted newest-first."""
    sp = _snapshots_dir()
    if not sp.exists():
        return []
    dates: dict[str, list[str]] = {}
    for f in sp.glob("*.json"):
        parts = f.stem.split("_", 1)
        if len(parts) != 2:
            continue
        date_str, mod_raw = parts
        mod_name = mod_raw.replace("_", "-")
        dates.setdefault(date_str, []).append(mod_name)
    return [
        {"date": d, "modules": sorted(mods)}
        for d, mods in sorted(dates.items(), reverse=True)
    ]


def _load_snapshot(date_str: str, module_name: str) -> dict[str, Any] | None:
    sp = _snapshots_dir()
    fname = sp / f"{date_str}_{module_name.replace('-', '_')}.json"
    if not fname.exists():
        return None
    try:
        return json.loads(fname.read_text())
    except Exception:
        return None


def _recent_verdicts(n: int = 7) -> list[dict[str, Any]]:
    """Return last n unique run dates from last_run.json history (approximated from snapshots)."""
    dates = _list_snapshot_dates()[:n]
    return dates


def _verdict_color(verdict: str) -> str:
    return {"BENIGN": "green", "SUSPECT": "amber", "CRITICAL": "red"}.get(verdict, "slate")


def _load_verdict(date_str: str, module_name: str) -> dict[str, Any] | None:
    p = AGENT_DIR / "data" / "verdicts" / f"{date_str}_{module_name.replace('-', '_')}.json"
    if not p.exists():
        return None
    try:
        return json.loads(p.read_text())
    except Exception:
        return None


def _run_history(n: int = 30) -> list[dict[str, Any]]:
    """Return last n entries from run_history.jsonl."""
    history_path = AGENT_DIR / "data" / "run_history.jsonl"
    rows: list[dict[str, Any]] = []
    if not history_path.exists():
        return rows
    for line in history_path.read_text().splitlines()[-n:]:
        try:
            rows.append(json.loads(line))
        except Exception:
            pass
    return rows


# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="Trion Agent Dashboard", docs_url=None, redoc_url=None)

STATIC_DIR.mkdir(parents=True, exist_ok=True)
TEMPLATES_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))
templates.env.filters["verdict_color"] = _verdict_color


# ---------------------------------------------------------------------------
# Auth routes
# ---------------------------------------------------------------------------

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request, error: str = ""):
    if _require_auth(request):
        return RedirectResponse("/", status_code=302)
    return templates.TemplateResponse(request, "login.html", {"error": error})


@app.post("/login")
async def login_submit(request: Request, password: str = Form(...)):
    if password == _ui_password():
        resp = RedirectResponse("/", status_code=302)
        resp.set_cookie(
            _COOKIE, _make_token(),
            httponly=True, samesite="lax", max_age=86400,
        )
        return resp
    return RedirectResponse("/login?error=1", status_code=302)


@app.get("/logout")
async def logout():
    resp = RedirectResponse("/login", status_code=302)
    resp.delete_cookie(_COOKIE)
    return resp


# ---------------------------------------------------------------------------
# Dashboard routes
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    if not _require_auth(request):
        return RedirectResponse("/login", status_code=302)
    cfg = load_config()
    last_run = _last_run()
    verdict = last_run.get("verdict", "—")
    modules_cfg = cfg.get("modules", {})
    enabled_modules = cfg.get("agent", {}).get("modules", [])
    module_cards = [
        {
            "name": m,
            "enabled": modules_cfg.get(m, {}).get("enabled", True),
        }
        for m in enabled_modules
    ]
    history_strip = _list_snapshot_dates()[:7]
    return templates.TemplateResponse(request, "index.html", {
        "last_run": last_run,
        "verdict": verdict,
        "verdict_color": _verdict_color(verdict),
        "baseline_exists": _baseline_exists(),
        "module_cards": module_cards,
        "history_strip": history_strip,
        "schedule": cfg.get("agent", {}).get("schedule", "07:00"),
        "llm_provider": cfg.get("llm", {}).get("provider", "—"),
        "llm_model": cfg.get("llm", {}).get("model", "—"),
    })


@app.get("/history", response_class=HTMLResponse)
async def history(request: Request):
    if not _require_auth(request):
        return RedirectResponse("/login", status_code=302)
    dates = _list_snapshot_dates()
    return templates.TemplateResponse(request, "history.html", {
        "dates": dates,
    })


@app.get("/history/{date_str}/{module_name}", response_class=HTMLResponse)
async def diff_detail(request: Request, date_str: str, module_name: str):
    if not _require_auth(request):
        return RedirectResponse("/login", status_code=302)
    snapshot = _load_snapshot(date_str, module_name)
    if snapshot is None:
        return HTMLResponse("Snapshot not found", status_code=404)

    # Compare with the previous day's snapshot for the same module to generate a diff view
    prev_date = (datetime.strptime(date_str, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
    prev_snapshot = _load_snapshot(prev_date, module_name) or {}

    # Build per-command diff rows
    diff_rows: list[dict[str, Any]] = []
    for cmd, new_out in snapshot.items():
        new_lines = set((new_out or "").splitlines())
        old_lines = set((prev_snapshot.get(cmd) or "").splitlines())
        added = sorted(new_lines - old_lines)
        removed = sorted(old_lines - new_lines)
        if added or removed:
            diff_rows.append({"command": cmd, "added": added, "removed": removed})

    return templates.TemplateResponse(request, "diff.html", {
        "date_str": date_str,
        "module_name": module_name,
        "diff_rows": diff_rows,
        "snapshot": snapshot,
        "prev_date": prev_date,
        "verdict": _load_verdict(date_str, module_name),
    })


@app.get("/settings", response_class=HTMLResponse)
async def settings_page(request: Request, saved: str = ""):
    if not _require_auth(request):
        return RedirectResponse("/login", status_code=302)
    cfg = load_config()
    agent_cfg = cfg.get("agent", {})
    llm_cfg = cfg.get("llm", {})
    notif_cfg = cfg.get("notifications", {})
    baseline_cfg = cfg.get("baseline", {})
    modules_cfg = cfg.get("modules", {})
    return templates.TemplateResponse(request, "settings.html", {
        "saved": saved == "1",
        "schedule": agent_cfg.get("schedule", "07:00"),
        "os_type": agent_cfg.get("os", "auto"),
        "config_drift_enabled": modules_cfg.get("config-drift", {}).get("enabled", True),
        "config_drift_ignore": "\n".join(modules_cfg.get("config-drift", {}).get("ignore_patterns", [])),
        "threat_detection_enabled": modules_cfg.get("threat-detection", {}).get("enabled", False),
        "threat_detection_ignore": "\n".join(modules_cfg.get("threat-detection", {}).get("ignore_patterns", [])),
        "llm_provider": llm_cfg.get("provider", "ollama"),
        "llm_model": llm_cfg.get("model", ""),
        "llm_endpoint": llm_cfg.get("endpoint", ""),
        "llm_api_key": llm_cfg.get("api_key", ""),
        "llm_timeout": llm_cfg.get("timeout", 30),
        "slack_webhook": notif_cfg.get("slack_webhook", ""),
        "webhook_url": notif_cfg.get("webhook_url", ""),
        "notify_on_suspect": "SUSPECT" in notif_cfg.get("notify_on", []),
        "notify_on_critical": "CRITICAL" in notif_cfg.get("notify_on", []),
        "retention_days": baseline_cfg.get("retention_days", 30),
    })


@app.post("/api/settings")
async def settings_save(
    request: Request,
    schedule: str = Form("07:00"),
    os_type: str = Form("auto"),
    config_drift_enabled: str = Form("off"),
    config_drift_ignore: str = Form(""),
    threat_detection_enabled: str = Form("off"),
    threat_detection_ignore: str = Form(""),
    llm_provider: str = Form("ollama"),
    llm_model: str = Form(""),
    llm_endpoint: str = Form(""),
    llm_api_key: str = Form(""),
    llm_timeout: int = Form(30),
    slack_webhook: str = Form(""),
    webhook_url: str = Form(""),
    notify_on_suspect: str = Form("off"),
    notify_on_critical: str = Form("off"),
    retention_days: int = Form(30),
):
    if not _require_auth(request):
        return RedirectResponse("/login", status_code=302)

    cfg = load_config()

    cfg.setdefault("agent", {})["schedule"] = schedule
    cfg["agent"]["os"] = os_type

    cfg.setdefault("llm", {}).update({
        "provider": llm_provider,
        "model": llm_model,
        "endpoint": llm_endpoint,
        "api_key": llm_api_key,
        "timeout": llm_timeout,
    })

    notify_on = []
    if notify_on_suspect == "on":
        notify_on.append("SUSPECT")
    if notify_on_critical == "on":
        notify_on.append("CRITICAL")
    cfg.setdefault("notifications", {})["slack_webhook"] = slack_webhook
    cfg["notifications"]["webhook_url"] = webhook_url
    cfg["notifications"]["notify_on"] = notify_on

    cfg.setdefault("baseline", {})["retention_days"] = retention_days

    def _parse_patterns(raw: str) -> list[str]:
        return [l.strip() for l in raw.splitlines() if l.strip()]

    cfg.setdefault("modules", {}).setdefault("config-drift", {}).update({
        "enabled": config_drift_enabled == "on",
        "ignore_patterns": _parse_patterns(config_drift_ignore),
    })
    cfg["modules"].setdefault("threat-detection", {}).update({
        "enabled": threat_detection_enabled == "on",
        "ignore_patterns": _parse_patterns(threat_detection_ignore),
    })

    save_config(cfg)
    return RedirectResponse("/settings?saved=1", status_code=302)


# ---------------------------------------------------------------------------
# API routes (JSON, called by JS)
# ---------------------------------------------------------------------------

@app.get("/api/status")
async def api_status(request: Request):
    if not _require_auth(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return JSONResponse({
        "last_run": _last_run(),
        "baseline_exists": _baseline_exists(),
    })


@app.get("/api/logs/stream")
async def logs_stream(request: Request):
    if not _require_auth(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    log_path = AGENT_DIR / "data" / "agent.log"

    async def event_generator():
        if not log_path.exists():
            yield "data: (no log file yet — run the agent first)\n\n"
            return
        async with aiofiles.open(log_path) as f:
            await f.seek(0, 2)  # tail from end
            deadline = asyncio.get_event_loop().time() + 300
            while asyncio.get_event_loop().time() < deadline:
                if await request.is_disconnected():
                    break
                line = await f.readline()
                if line:
                    yield f"data: {line.rstrip()}\n\n"
                else:
                    await asyncio.sleep(0.4)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@app.get("/api/history/chart")
async def history_chart(request: Request):
    if not _require_auth(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    return JSONResponse(_run_history(30))


@app.post("/api/run")
async def api_run(request: Request):
    if not _require_auth(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    try:
        subprocess.Popen(
            [sys.executable, str(AGENT_DIR / "agent.py"), "--run-now"],
            cwd=str(AGENT_DIR),
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        return JSONResponse({"status": "started"})
    except Exception as exc:
        logger.error("Failed to start agent run: %s", exc)
        return JSONResponse({"error": str(exc)}, status_code=500)


@app.post("/api/reset-baseline")
async def api_reset_baseline(request: Request):
    if not _require_auth(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    cfg = load_config()
    baseline_path = AGENT_DIR / cfg.get("baseline", {}).get("path", "data/baseline.json")
    if baseline_path.exists():
        baseline_path.unlink()
        logger.info("Baseline reset via dashboard")
        return JSONResponse({"status": "reset"})
    return JSONResponse({"status": "not_found"})


@app.post("/api/modules/{module_name}/toggle")
async def api_toggle_module(request: Request, module_name: str):
    if not _require_auth(request):
        return JSONResponse({"error": "unauthorized"}, status_code=401)
    allowed = {"config-drift", "threat-detection"}
    if module_name not in allowed:
        return JSONResponse({"error": "unknown module"}, status_code=400)
    cfg = load_config()
    current = cfg.get("modules", {}).get(module_name, {}).get("enabled", True)
    cfg.setdefault("modules", {}).setdefault(module_name, {})["enabled"] = not current
    save_config(cfg)
    return JSONResponse({"module": module_name, "enabled": not current})


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    cfg = load_config()
    port = int(cfg.get("ui", {}).get("port", 8080))
    logger.info("Starting Trion Agent Dashboard on http://0.0.0.0:%d", port)
    uvicorn.run("agent_ui:app", host="0.0.0.0", port=port, reload=False)
