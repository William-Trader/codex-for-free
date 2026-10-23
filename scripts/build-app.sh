#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/dist/Codex for Free.app"
VERSION="$(node -p "require('$ROOT/package.json').version")"
ZIP="$ROOT/dist/Codex-for-Free-$VERSION-macOS.zip"
rm -rf "$APP" "$ZIP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/app"
cp "$ROOT/macapp/Info.plist" "$APP/Contents/Info.plist"
cp "$ROOT/macapp/CodexForFree.sh" "$APP/Contents/MacOS/CodexForFree"
chmod +x "$APP/Contents/MacOS/CodexForFree"
rsync -a "$ROOT/bin" "$ROOT/src" "$ROOT/public" "$ROOT/package.json" "$APP/Contents/Resources/app/"
# Bundle the Codex CLI so the app does not depend on ChatGPT.app after install.
CODEX_CLI_SRC="${CODEX_CLI_SRC:-/Applications/ChatGPT.app/Contents/Resources/codex-cli}"
if [ ! -d "$CODEX_CLI_SRC" ] && [ -d "$ROOT/vendor/codex-cli" ]; then
  CODEX_CLI_SRC="$ROOT/vendor/codex-cli"
fi
if [ ! -x "$CODEX_CLI_SRC/bin/codex" ]; then
  echo "Codex CLI not found at $CODEX_CLI_SRC (set CODEX_CLI_SRC)" >&2
  exit 1
fi
rsync -a "$CODEX_CLI_SRC" "$APP/Contents/Resources/"
# bundle Node.js runtime so the app does not depend on a system install
NODE_BIN="${NODE_BIN:-$(command -v node)}"
if [ -z "${NODE_BIN:-}" ] || [ ! -x "$NODE_BIN" ]; then
  echo "node not found" >&2
  exit 1
fi
mkdir -p "$APP/Contents/Resources/node/bin"
cp "$NODE_BIN" "$APP/Contents/Resources/node/bin/node"
chmod +x "$APP/Contents/Resources/node/bin/node"
NODE_ROOT="$(cd "$(dirname "$NODE_BIN")/.." && pwd)"
if [ -f "$NODE_ROOT/LICENSE" ]; then
  cp "$NODE_ROOT/LICENSE" "$APP/Contents/Resources/node/LICENSE"
fi
# icon
TMP="$(mktemp -d)"
ICON_SRC="$ROOT/macapp/icon-board.png"
if [ ! -f "$ICON_SRC" ]; then
  qlmanage -t -s 1024 -o "$TMP" "$ROOT/public/avatar.svg" >/dev/null 2>&1 || true
  ICON_SRC="$TMP/avatar.svg.png"
fi
if [ -f "$ICON_SRC" ]; then
  ICONSET="$TMP/AppIcon.iconset"
  mkdir -p "$ICONSET"
  for s in 16 32 128 256 512; do
    sips -z $s $s "$ICON_SRC" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
    d=$((s*2))
    sips -z $d $d "$ICON_SRC" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns" >/dev/null 2>&1 || true
fi
rm -rf "$TMP"
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true
ditto -c -k --keepParent "$APP" "$ZIP"
echo "Built: $APP"
echo "Zip:   $ZIP"
