#!/usr/bin/env bash
set -euo pipefail

OS=$(uname -s)
# Use the script's own directory, not the caller's cwd.
AGENT_DIR=$(cd "$(dirname "$0")" && pwd)

# ── Python version check ─────────────────────────────────────────────────────
PYTHON_CMD=""
for cmd in python3.12 python3.11 python3; do
  if command -v "$cmd" &>/dev/null; then
    ver=$("$cmd" -c 'import sys; print(sys.version_info[:2])')
    if "$cmd" -c 'import sys; sys.exit(0 if sys.version_info >= (3,11) else 1)' 2>/dev/null; then
      PYTHON_CMD="$cmd"
      break
    fi
  fi
done

if [[ -z "$PYTHON_CMD" ]]; then
  echo "[trion-agent] ERROR: Python 3.11 or newer is required." >&2
  echo "  Install it from https://python.org or via your package manager." >&2
  exit 1
fi

echo "[trion-agent] Using $($PYTHON_CMD --version)"

# ── Dependencies ─────────────────────────────────────────────────────────────
echo "[trion-agent] Installing dependencies..."
"$PYTHON_CMD" -m pip install -r requirements.txt

# ── Config ───────────────────────────────────────────────────────────────────
echo "[trion-agent] Setting up config..."
if [ ! -f config.toml ]; then
  cp config.toml.example config.toml
  chmod 600 config.toml
  echo "[trion-agent] Edit config.toml before first run."
fi

mkdir -p data/snapshots
chmod 700 data/

# ── Scheduler ────────────────────────────────────────────────────────────────
if [ "$OS" = "Linux" ]; then
  echo "[trion-agent] Installing systemd units..."
  mkdir -p ~/.config/systemd/user/

  sed "s|AGENT_DIR|$AGENT_DIR|g" trion-agent.service > ~/.config/systemd/user/trion-agent.service
  sed "s|AGENT_DIR|$AGENT_DIR|g" trion-agent.timer   > ~/.config/systemd/user/trion-agent.timer

  systemctl --user daemon-reload
  systemctl --user enable trion-agent.timer
  systemctl --user start trion-agent.timer
  echo "[trion-agent] Systemd timer installed and started."

elif [ "$OS" = "Darwin" ]; then
  echo "[trion-agent] Installing LaunchAgent..."
  sed "s|AGENT_DIR|$AGENT_DIR|g" com.trion.agent.plist > ~/Library/LaunchAgents/com.trion.agent.plist
  launchctl load ~/Library/LaunchAgents/com.trion.agent.plist
  echo "[trion-agent] LaunchAgent installed."
fi

echo "[trion-agent] Done. Run '$PYTHON_CMD agent.py --run-now' to test immediately."
