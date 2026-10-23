# Operations

## Install / reinstall the GPT frontend

Prerequisite: official `ChatGPT.app` is installed at `/Applications/ChatGPT.app`.

```bash
cd installer
./install.sh
```

Or double-click `Install Codex for Free.command`.

The installer:

1. copies the official app to a temporary directory
2. changes the display name and icon
3. re-signs the outer bundle
4. replaces `/Applications/Codex for Free.app`
5. backs up `~/.codex/config.toml`
6. writes the DeepSeek provider
7. opens the app

## Panel and CLI

```bash
cfm doctor
cfm panel                 # local management panel
cfm knowledge             # open ~/Documents/Codex Library
cfm library list
cfm providers list
cfm providers test deepseek
```

The panel is a separate local web app. The GPT frontend is not modified by the panel.

## Provider

Current shape:

```toml
model = "deepseek-v4-pro"
model_provider = "deepseek"
model_catalog_json = "~/.codex-for-mac/catalog/deepseek.json"
model_reasoning_effort = "medium"

[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com/v1"
wire_api = "responses"
```

Keys live in `~/.codex-for-mac/secrets/` or the 0600 config. Never commit them.

## Login bypass

The frontend is not signed into ChatGPT. It uses the custom provider, so `codex login status` can report `Not logged in` while chat works.

Consequences:

- local chat and shell tools work
- ChatGPT account/cloud/remote-control features are unavailable
- image generation and other OpenAI-only capabilities are not equivalent

## Troubleshooting

### Panel does not open

```bash
cfm panel
curl -sS http://127.0.0.1:4317/api/summary
```

If the port is occupied, choose another port:

```bash
cfm panel --port 4318
```

### App asks for login again

The installer writes a custom provider block. If the official app updated, rerun `installer/install.sh`; it backs up the config first.

### Library looks re-populated with test chats

`cfm library export` reads Codex sessions. Archive the test projects again; do not delete the archive.

### Restore config

```bash
ls ~/.codex/config.toml.bak-login-*
cp ~/.codex/config.toml.bak-login-YYYY... ~/.codex/config.toml
```

## Release checks

```bash
node --test
zsh -n installer/install.sh
unzip -l dist/Codex-for-Free-1.1.0-Installer.zip
```

Release asset must not contain the OpenAI app or any API key.
