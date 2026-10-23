# Architecture

## Two layers

### 1. GPT frontend

`/Applications/Codex for Free.app` is a local copy of the official ChatGPT/Codex desktop app with:

- `CFBundleName` / `CFBundleDisplayName` changed to `Codex for Free`
- a local icon
- an ad-hoc outer signature
- a custom DeepSeek provider in `~/.codex/config.toml`

The official app bundle is **not** included in this repository. The installer builds the local copy from `/Applications/ChatGPT.app`.

### 2. Local tools

The repository still contains the local panel and CLI:

- `bin/cfm.mjs`: CLI entry point
- `src/`: provider registry, library export, storage tools, panel server
- `public/`: browser panel
- `installer/`: GPT frontend installer

The panel is an independent local web app. It is not embedded in the GPT frontend.

## Data locations

| Path | Purpose |
|---|---|
| `~/.codex` | GPT frontend live data and config |
| `~/.codex-for-mac` | provider registry, secrets, model catalog |
| `~/.codex-for-free` | legacy isolated data; not used by the current GPT frontend |
| `~/Documents/Codex Library` | exported human-readable conversation library |

## Config merge

`installer/install.sh` modifies only these areas:

- top-level model selection
- `[model_providers.deepseek]`
- desktop reasoning options

Before writing, it backs up `~/.codex/config.toml` as `config.toml.bak-login-*`. Existing plugins, marketplaces, MCP servers and desktop settings are preserved.

## Boundaries

- The OpenAI desktop app is closed source; the project does not redistribute it.
- Login bypass is local configuration, not an OpenAI-supported mode.
- Account-bound cloud features will not behave like a signed-in official app.
- Official app updates may overwrite local naming and config.
"