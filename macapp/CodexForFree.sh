#!/bin/zsh
set -u
APP_DIR="$(cd "$(dirname "$0")/../Resources/app" && pwd)"
LOG="$HOME/Library/Logs/CodexForFree.log"
mkdir -p "$HOME/Library/Logs"
NODE="$APP_DIR/../node/bin/node"
if [ ! -x "$NODE" ]; then
  NODE="$(command -v node 2>/dev/null || true)"
fi
if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
  NODE="$(/bin/zsh -lc 'command -v node' 2>/dev/null || true)"
fi
if [ -z "$NODE" ] || [ ! -x "$NODE" ]; then
  osascript -e 'display dialog "Codex for Free 内置的 Node 组件缺失，且系统未找到 Node.js。请重新下载完整应用包。" buttons {"好"} default button 1 with icon caution'
  exit 1
fi
export CFM_CODEX_HOME="$HOME/.codex-for-free"
export CFM_HOME="$HOME/.codex-for-mac"
export PATH="$(dirname "$NODE"):/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin"
if curl -fsS --max-time 1 http://127.0.0.1:4317/api/summary >/dev/null 2>&1; then
  open "http://127.0.0.1:4317/?view=chat"
  exit 0
fi
nohup "$NODE" "$APP_DIR/bin/cfm.mjs" ui --no-open --port 4317 >>"$LOG" 2>&1 &
for i in {1..40}; do
  if curl -fsS --max-time 1 http://127.0.0.1:4317/api/summary >/dev/null 2>&1; then
    break
  fi
  sleep 0.25
done
open "http://127.0.0.1:4317/?view=chat"
