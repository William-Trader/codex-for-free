# Changelog

## v1.3.1 — 2026-10-24

Windows hardening pass after the 1.3.0 port. No macOS files touched.

### Fixed

- `cfm.cmd` / `cff.cmd` shims were generated with a literal `"${node}"`
  instead of the interpreter path, so the shim could never start. Now emits
  the real `node.exe` and `bin/cfm.mjs` paths.
- `cfm repair` passed the API key as `-Key` on the child command line, where
  any local process could read it. It now goes through `CFM_KEY` in the child
  environment.
- `cfm ui` / `cfm panel` called macOS `open` on Windows, which crashed the
  server with an unhandled `ENOENT`. Uses `explorer.exe` now.
- Chinese output was mojibake on a 936 console. The entry point switches the
  console to 65001 for the run and restores the previous code page on exit.
- `cfm restore` reported `providers/secrets` even though backups exclude
  secrets; the label is now `providers/catalog`.
- `cfm install-cli` claimed the shim directory was missing from PATH even when
  it was already persisted for the user.

### Added

- `isSafeArchiveEntry()`: rejects absolute paths, drive letters, NUL and `..`
  in both separator styles before a restore extracts anything.
- Test coverage for the archive escape rules (25 tests total).

### Verified on Windows

- `cfm backup` → 21 entries, **0** `secrets` entries; `cfm restore` round-trip
  leaves `config.toml` parseable (`python tomllib`) and `doctor ok: true`.
- `cfm library export` → 4 projects / 5 conversations from the live app DB.
- `cfm.cmd version`, `cff.cmd config check` both work through the shim.

## v1.3.0 — 2026-10-24

Windows port. Core behaviour is unchanged; the additions are Windows-specific,
which is why this is a minor bump rather than a silent patch to 1.2.0.

### Added

- `installer/install.ps1`: no admin rights, no app rename, no login bypass.
- `cfm install-cli` on Windows writes `cfm.cmd` / `cff.cmd` shims.
- `cfm config check`: duplicate key/table lint + `python tomllib`.
- `cfm completion powershell`.
- `docs/WINDOWS.md`.

### Changed

- `locateCodex()` discovers `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\codex.exe`.
- `which()` honours `PATHEXT`.
- DeepSeek preset: 1,048,576 context, `low/high/max`, default `high`.
- Secrets and config get a user-only ACL; `doctor` reports `acl-private`.
- Backups exclude `secrets/` and use `Compress-Archive` on Windows.
- Library search results always use `/` (portable index).
