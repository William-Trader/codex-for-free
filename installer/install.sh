#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
TARGET="/Applications/Codex for Free.app"
OFFICIAL="${CHATGPT_APP:-/Applications/ChatGPT.app}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer is for macOS only." >&2
  exit 1
fi

if [[ ! -d "$OFFICIAL" ]]; then
  echo "ChatGPT.app not found at: $OFFICIAL" >&2
  echo "Install the official ChatGPT macOS app first, or set CHATGPT_APP." >&2
  exit 1
fi

KEY="${CFM_KEY:-${DEEPSEEK_API_KEY:-${CFM_DEEPSEEK_KEY:-}}}"
if [[ -z "$KEY" ]]; then
  printf "DeepSeek API key: "
  stty -echo
  IFS= read -r KEY
  stty echo
  printf "\n"
fi
if [[ -z "$KEY" ]]; then
  echo "No API key supplied." >&2
  exit 1
fi

# Stop the old frontend before replacing it.
osascript -e 'tell application "ChatGPT" to quit' >/dev/null 2>&1 || true
osascript -e 'tell application "Codex for Free" to quit' >/dev/null 2>&1 || true
pkill -f '/Applications/Codex for Free.app/Contents/MacOS/ChatGPT' >/dev/null 2>&1 || true
sleep 2

STAGE_DIR="$(mktemp -d)"
STAGE="$STAGE_DIR/Codex for Free.app"
cleanup() { rm -rf "$STAGE_DIR"; }
trap cleanup EXIT

# Copy first, then modify the copy. This avoids macOS App Management
# rejecting writes inside the signed app bundle at /Applications.
ditto "$OFFICIAL" "$STAGE"

/usr/libexec/PlistBuddy -c 'Set :CFBundleName Codex for Free' "$STAGE/Contents/Info.plist"
/usr/libexec/PlistBuddy -c 'Set :CFBundleDisplayName Codex for Free' "$STAGE/Contents/Info.plist"
if [[ -f "$ROOT/AppIcon.icns" ]]; then
  cp "$ROOT/AppIcon.icns" "$STAGE/Contents/Resources/AppIcon.icns"
  /usr/libexec/PlistBuddy -c 'Set :CFBundleIconFile AppIcon' "$STAGE/Contents/Info.plist"
fi

# Re-sign the outer bundle after editing Info.plist. Nested helpers keep
# their original signatures.
codesign --force --sign - "$STAGE" >/dev/null

OLD=""
if [[ -d "$TARGET" ]]; then
  OLD="/tmp/CodexForFree-old-$(date +%s).app"
  mv "$TARGET" "$OLD"
fi
mv "$STAGE" "$TARGET"
trap - EXIT
cleanup
xattr -dr com.apple.quarantine "$TARGET" >/dev/null 2>&1 || true

mkdir -p "$HOME/.codex-for-mac/catalog"
cp "$ROOT/catalog/deepseek.json" "$HOME/.codex-for-mac/catalog/deepseek.json"
chmod 700 "$HOME/.codex-for-mac" 2>/dev/null || true
chmod 600 "$HOME/.codex-for-mac/catalog/deepseek.json" 2>/dev/null || true

CFM_KEY="$KEY" CFM_CATALOG="$HOME/.codex-for-mac/catalog/deepseek.json" python3 - "$HOME/.codex/config.toml" <<'PY'
import datetime
import os
import pathlib
import re
import shutil
import sys

cfg = pathlib.Path(sys.argv[1])
key = os.environ["CFM_KEY"].replace("\\", "\\\\").replace('"', '\\"')
catalog = os.environ["CFM_CATALOG"]
cfg.parent.mkdir(parents=True, exist_ok=True)

old = ""
if cfg.exists():
    stamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    backup = cfg.with_name(cfg.name + ".bak-login-" + stamp)
    shutil.copy2(cfg, backup)
    old = cfg.read_text()

text = re.sub(r"# >>> cfm:login-bypass[\s\S]*?# <<< cfm:login-bypass\n?", "", old)
for name in ("model", "model_provider", "model_catalog_json", "model_reasoning_effort"):
    text = re.sub(rf"^{name}\s*=.*\n?", "", text, flags=re.M)
text = re.sub(r"\[model_providers\.deepseek\][\s\S]*?(?=\n\[|\Z)", "", text).rstrip()
text = re.sub(r"(?m)^enabled-reasoning-efforts\s*=.*$", 'enabled-reasoning-efforts = ["low", "medium", "high"]', text)

block = (
    "# >>> cfm:login-bypass\n"
    'model = "deepseek-v4-pro"\n'
    'model_provider = "deepseek"\n'
    f'model_catalog_json = "{catalog}"\n'
    'model_reasoning_effort = "medium"\n'
    "# <<< cfm:login-bypass\n\n"
)
provider = (
    "\n\n[model_providers.deepseek]\n"
    'name = "DeepSeek"\n'
    'base_url = "https://api.deepseek.com/v1"\n'
    'wire_api = "responses"\n'
    'http_headers = { "Authorization" = "Bearer ' + key + ' }\n'
)
cfg.write_text(block + text.strip() + provider)
os.chmod(cfg, 0o600)
print("config: " + str(cfg))
print("backup: " + (str(cfg.with_name(cfg.name + ".bak-login-*")) if old else "(new config)"))
PY

if [[ -n "$OLD" ]]; then
  rm -rf "$OLD"
fi

open -a "$TARGET"
echo "Installed: $TARGET"
echo "The app opens with the GPT frontend; login is bypassed via the DeepSeek provider."
