#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="$ROOT/dist/Codex for Free.app"
ZIP="$ROOT/dist/Codex-for-Free-1.0.5-macOS.zip"
rm -rf "$APP" "$ZIP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/app"
cp "$ROOT/macapp/Info.plist" "$APP/Contents/Info.plist"
cp "$ROOT/macapp/CodexForFree.sh" "$APP/Contents/MacOS/CodexForFree"
chmod +x "$APP/Contents/MacOS/CodexForFree"
rsync -a "$ROOT/bin" "$ROOT/src" "$ROOT/public" "$ROOT/package.json" "$APP/Contents/Resources/app/"
# icon
TMP="$(mktemp -d)"
if qlmanage -t -s 1024 -o "$TMP" "$ROOT/public/avatar.svg" >/dev/null 2>&1 && [ -f "$TMP/avatar.svg.png" ]; then
  ICONSET="$TMP/AppIcon.iconset"
  mkdir -p "$ICONSET"
  for s in 16 32 128 256 512; do
    sips -z $s $s "$TMP/avatar.svg.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
    d=$((s*2))
    sips -z $d $d "$TMP/avatar.svg.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns" >/dev/null 2>&1 || true
fi
rm -rf "$TMP"
codesign --force --deep --sign - "$APP" >/dev/null 2>&1 || true
ditto -c -k --keepParent "$APP" "$ZIP"
echo "Built: $APP"
echo "Zip:   $ZIP"
