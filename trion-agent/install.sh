#!/bin/bash
set -e

OS=$(uname -s)
AGENT_DIR=$(pwd)

echo "[trion-agent] Installing dependencies..."
pip3 install -r requirements.txt

echo "[trion-agent] Setting up config..."
if [ ! -f config.toml ]; then
  cp config.toml.example config.toml
  chmod 600 config.toml
  echo "[trion-agent] Edit config.toml before first run."
fi

mkdir -p data/snapshots
chmod 700 data/

if [ "$OS" = "Linux" ]; then
  echo "[trion-agent] Installing systemd units..."
  mkdir -p ~/.config/systemd/user/

  # Remplacer AGENT_DIR dans les unit files
  sed "s|AGENT_DIR|$AGENT_DIR|g" trion-agent.service > ~/.config/systemd/user/trion-agent.service
  sed "s|AGENT_DIR|$AGENT_DIR|g" trion-agent.timer > ~/.config/systemd/user/trion-agent.timer

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

echo "[trion-agent] Done. Run 'python3 agent.py --run-now' to test immediately."
