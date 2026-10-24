# Windows

Ported from the macOS installer in v1.3.0. The goal is not "the same script with
PowerShell syntax": it is the same three contracts.

1. `config.toml` stays valid TOML: no duplicated root keys, one
   `[model_providers.deepseek]`.
2. The model catalog matches what `GET /models` really reports.
3. Every claim is backed by a real run.

## What differs from macOS

| Area | macOS | Windows |
|---|---|---|
| Official app | copied and renamed to `Codex for Free.app` | **never touched**: no rename, no re-sign, no copy |
| Login | bypassed by the custom provider | **not bypassed**; the ChatGPT account keeps working |
| Provider config | `~/.codex/config.toml` | `%USERPROFILE%\.codex\config.toml` |
| Registry / catalog / secrets | `~/.codex-for-mac/` | `%USERPROFILE%\.codex-for-mac\` (same name, no fork) |
| CLI entry | symlink in `/usr/local/bin` | `cfm.cmd` shim in `%LOCALAPPDATA%\Programs\cfm` |
| Path | `~/.zshrc` | user `PATH` via `[Environment]::SetEnvironmentVariable` |
| Secret mode | `chmod 600` | `icacls /inheritance:r /grant:r <user>:F` |
| Library | `~/Documents/Codex Library` | `%USERPROFILE%\Documents\Codex Library` |
| Backup | `tar -czf` → `.tar.gz` | `Compress-Archive` → `.zip` |
| Completion | zsh / bash | `cfm completion powershell` |

Nothing needs administrator rights. `installer/install.ps1` is additive.

## Install

```powershell
# from the repo root
powershell -ExecutionPolicy Bypass -File installer\install.ps1
```

The script prompts for the API key with a masked prompt (`Read-Host
-AsSecureString`); it never echoes it, never logs it and never puts it on a
command line. For automation, `CFM_KEY` in the environment is accepted.

What it does, in order:

1. preflight (node >= 24, repo layout, app presence)
2. back up `config.toml` → `config.toml.bak-cfm-<yyyyMMddHHmmss>`
3. `cfm providers add deepseek --key-stdin` (secret → `.codex-for-mac\secrets\deepseek.key`, ACL-locked)
4. `cfm providers sync deepseek` (reads `/models`)
5. `cfm catalog build deepseek`
6. `cfm providers use deepseek --model deepseek-flash --effort high`
7. `cfm config check` (duplicate-key lint + `python tomllib` when available)
8. `cfm install-cli` (writes `cfm.cmd`, appends the user PATH)

## Codex CLI discovery

The desktop app ships the CLI inside a build-hashed folder:

```text
%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\codex.exe
```

`locateCodex()` lists every `bin\<hash>\codex.exe`, sorts by mtime and picks the
newest, so an app update is followed without editing code. `CODEX_BIN` still
overrides everything.

## Verification (real runs)

Windows 11 10.0.26300 / PowerShell 5.1.26100 / node 24.19.0 / codex-cli 0.163.0-alpha.10.2.

| # | Check | Command | Result |
|---|---|---|---|
| 1 | doctor | `cfm doctor --json` | `ok: true`, codex `0.163.0-alpha.10.2` |
| 2 | provider | `cfm providers test deepseek` | /models 200, /responses 200, 2 models |
| 3 | catalog sync | `cfm providers sync deepseek` | ctx=1048576, effort=low\|high\|max, default=high |
| 4 | TOML | `cfm config check` | no duplicate keys/tables, `python tomllib` parsed |
| 5 | single turn | `codex exec "17*23"` | `391`, 6.4 s |
| 6 | edit file | `codex exec "fix add() in calc.py"` | file changed `a - b` → `a + b`, run printed `5`, 17.1 s |
| 7 | run command | `codex exec "create run.ps1 and run it"` | 48*7 → `336`, independent re-run `336`, 13.6 s |
| 8 | tests | `node --test` | 25 pass / 0 fail |
| 9 | backup | `cfm backup --out bk.zip` | 21 entries, **0** `secrets` entries |
| 10 | restore | `cfm restore bk.zip --yes` | config/providers/library restored; `config check` still passes |
| 11 | library | `cfm library export` | 4 projects / 5 conversations from the live DB |
| 12 | CLI shim | `cfm.cmd version` | `1.3.0` through `%LOCALAPPDATA%\Programs\cfm` |

Catalog fields observed in `.codex-for-mac\catalog\deepseek.json`:

| field | deepseek-flash | deepseek-v4-pro |
|---|---|---|
| `context_window` | 1048576 | 1048576 |
| `max_context_window` | 1048576 | 1048576 |
| `effective_context_window_percent` | 95 | 95 |
| `truncation_policy` | `{mode:"tokens", limit:60000}` | same |
| `supported_reasoning_levels` | low / high / max | low / high / max |
| `default_reasoning_level` | high | high |
| `input_modalities` | text + image | text |

## Round 2 fixes (1.3.0)

- shim template bug: the generated `.cmd` contained a literal `"${node}"`
- `repair` no longer puts the API key on a child command line
- `cfm ui` no longer crashes on `spawn open ENOENT`
- UTF-8 console handling (65001 for the run, original code page restored)
- archive entries validated for both separator styles and drive letters
- PATH messaging fixed when the directory is already persisted

## Known limits

- `--sandbox workspace-write` is not honoured by this build on Windows: the
  session reports `sandbox: read-only` and both `apply_patch` and
  `exec_command` are rejected. The file/command tests therefore ran with
  `--sandbox danger-full-access`. Treat Windows sandboxing as unverified.
- The Codex desktop UI itself was not exercised (only the CLI it ships).
- Image input is declared by the API for `deepseek-flash` but was not tested end
  to end.
- `cfm library export` needs real conversation history; a fresh profile exports
  nothing, so `doctor` keeps one `library` warning until then.
