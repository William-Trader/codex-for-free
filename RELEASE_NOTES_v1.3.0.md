# v1.3.0 — Windows

Windows support for the provider contract, without touching the official app.

## What this release does

- Adds DeepSeek as an **optional** provider to the official Codex desktop app
  on Windows.
- Leaves the ChatGPT login alone: account features keep working.
- Adds `installer/install.ps1` and a `cfm.cmd` shim; no administrator rights.

## What it deliberately does not do

- No app rename, no re-sign, no copy of the official binary.
- No login bypass.
- No OpenAI binary in the repo or in any release asset.

## Verified on this machine

Windows 11 10.0.26300 / PowerShell 5.1.26100 / node 24.19.0 /
codex-cli 0.163.0-alpha.10.2, DeepSeek `deepseek-flash`, effort `high`:

| Check | Result |
|---|---|
| `cfm doctor --json` | `ok: true` |
| `cfm providers test deepseek` | /models 200, /responses 200 |
| `cfm providers sync deepseek` | ctx=1048576, effort=low\|high\|max, default=high |
| `cfm config check` | no duplicate keys, `tomllib` parsed |
| `codex exec` single turn | 391 in 6.4 s |
| `codex exec` edit + run | changed one operator, printed 5, 17.1 s |
| `codex exec` create + run script | printed 336, re-run 336, 13.6 s |
| `node --test` | 24 pass / 0 fail |

## Bump rationale

Behaviour of the shared code paths is unchanged; the Windows additions
(`install.ps1`, `cfm.cmd`, ACL handling, `Compress-Archive`) are new surface,
so the version moves to 1.3.0 instead of re-tagging 1.2.0.
