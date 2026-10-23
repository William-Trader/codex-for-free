#!/bin/zsh
# Double-click this file to start Codex for Free.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  osascript -e 'display dialog "需要先安装 Node.js 24（nodejs.org）。安装后再双击本文件。" buttons {"好"} default button 1 with icon caution'
  exit 1
fi
exec node bin/cfm.mjs ui
