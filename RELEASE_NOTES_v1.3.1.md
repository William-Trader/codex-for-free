# v1.3.1 — Windows

Windows build of the same version. macOS assets are unchanged since v1.2.0.

## Install

    powershell -ExecutionPolicy Bypass -File installer\install.ps1

or double-click `installer\Install Codex for Free.cmd`.

No administrator rights. The official Codex app is not renamed, re-signed,
copied or replaced, and the ChatGPT sign-in is not bypassed.

## What it does

1. preflight (node >= 24, repo layout, official app present)
2. backup `%USERPROFILE%\.codex\config.toml` → `config.toml.bak-cfm-<timestamp>`
3. register the DeepSeek provider (key via stdin / `CFM_KEY`, never on a command line)
4. `cfm providers sync` — real context and effort levels from `GET /models`
5. `cfm catalog build`
6. `cfm providers use deepseek --model deepseek-flash --effort high`
7. `cfm config check` — duplicate key/table lint + `python tomllib`
8. `cfm install-cli` — `cfm.cmd` / `cff.cmd` in `%LOCALAPPDATA%\Programs\cfm`

## Verified on Windows 11 (10.0.26300)

| Check | Result |
|---|---|
| `cfm doctor --json` | ok, codex-cli 0.163.0-alpha.10.2, config acl-private |
| `cfm providers test deepseek` | /models 200, /responses 200, 2 models |
| catalog | ctx 1,048,576, effort low/high/max, default high |
| `cfm config check` | no duplicate keys; tomllib parsed |
| `codex exec` single turn | 391 / 6.4 s |
| `codex exec` edit + run | operator fixed, printed 5 / 17.1 s |
| `codex exec` create + run | 336, re-run 336 / 13.6 s |
| `cfm backup` → `cfm restore` | 21 entries, 0 secrets, config still valid |
| `node --test` | 25 pass / 0 fail |

## Fixed in this build

- `cfm.cmd` contained a literal `"${node}"` and could never start
- `cfm repair` exposed the API key on a child command line
- `cfm ui` crashed the server on macOS `open` (`spawn ENOENT`)
- Chinese output was mojibake on a 936 console
- archive entries were not validated before restore

## Known limits

- `--sandbox workspace-write` is downgraded to read-only by this Windows build;
  write/exec verification used `danger-full-access`. Windows sandboxing is unverified.
- The desktop UI's first-run survey needs one manual click (injected input into the
  MSIX window is blocked).
- Image input declared by the API for `deepseek-flash` is untested end to end.
