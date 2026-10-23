# Verification

Checked on 2026-10-23 on macOS 27.0.1 arm64.

## Status matrix

| Area | Check | Result |
|---|---|---|
| App install | `/Applications/Codex for Free.app` exists | pass |
| App launch | process `/Contents/MacOS/ChatGPT` running | pass |
| Frontend | opens Codex chat, no login screen | pass |
| Model | `deepseek-flash`, provider `deepseek` | pass |
| Provider API | `/models` and `/responses` both HTTP 200 | pass |
| Chat | simple chat returns | pass |
| Tools | command_execution creates a file and returns output | pass |
| Doctor | `cfm doctor --json` returns structured status | pass |
| Search | `cfm search COEXIST` returns matches | pass |
| Backup | backup archive 600, contains config/providers/library | pass |
| Panel | `cfm panel --port 4318` returns HTTP 200 | pass |
| Library | 1 active project / 1 conversation | pass |
| Installer config | writes key, no placeholder, mode 600 | pass |
| Repair | guard errors when official app is missing | pass (not run destructively) |
| Uninstall | guard errors without `--yes` | pass (not run destructively) |
| Completion | `cfm completion zsh` emits completion | pass |

## Known limitations

- Login bypass means ChatGPT account cloud features, remote control and cloud tasks are unavailable.
- OpenAI image generation and account-only capabilities are not equivalent under DeepSeek.
- Official app updates can overwrite local naming and config; run `cfm repair` or `installer/install.sh` afterward.
- `repair`, `uninstall` and `restore` are destructive/replacement operations. Only their guards and code paths were checked; they were not executed against the live app.
- The panel is a separate local web app, not embedded in the GPT frontend.

## Commands used

```bash
cfm doctor --json
cfm providers test deepseek
cfm search COEXIST
cfm backup --out /tmp/cff-backup-test.tar.gz
cfm panel --port 4318
node --test
zsh -n installer/install.sh
```
