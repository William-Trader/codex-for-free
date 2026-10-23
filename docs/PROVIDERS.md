# 供应商与模型接入

## 原理

codex-for-free 只改 `~/.codex/config.toml` 的两个受控区域：

```toml
# >>> cfm:defaults
model = "deepseek-v4-pro"
model_provider = "deepseek"
model_catalog_json = "/Users/me/.codex-for-mac/catalog/deepseek.json"
model_reasoning_effort = "medium"
# <<< cfm:defaults

# >>> cfm:provider:deepseek
[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com/v1"
wire_api = "responses"
http_headers = { "Authorization" = "Bearer sk-***" }
# <<< cfm:provider:deepseek
```

其余内容（`[desktop]`、plugins、marketplaces、MCP server）原样保留。

## 预设

| id | base URL | 模型（可改） | 备注 |
|---|---|---|---|
| deepseek | https://api.deepseek.com/v1 | deepseek-v4-pro, deepseek-flash | 本机实测可用，支持 /responses |
| qwen | https://dashscope.aliyuncs.com/compatible-mode/v1 | qwen3-max, qwen3-coder-plus, qwen-plus, qwen-turbo | 需确认 Responses API |
| kimi | https://api.moonshot.cn/v1 | kimi-k2.5, kimi-k2-0905-preview | 需确认 Responses API |
| zhipu | https://open.bigmodel.cn/api/paas/v4 | glm-4.6, glm-4.5-air | 需确认 Responses API |
| minimax | https://api.minimax.chat/v1 | MiniMax-M2 | 需确认 Responses API |
| openai-compatible | 自定义 | 自定义 | 必须支持 /responses |

## 命令

```bash
cfm providers presets
cfm providers add qwen --key-stdin
cfm providers use qwen --model qwen3-max --effort high
cfm providers test qwen
cfm providers list
```

`test` 会：

1. `GET {baseUrl}/models`，确认 key 与连通性；
2. `POST {baseUrl}/responses`，用第一个模型发 8 token 的探针，确认 Codex 能直接用。

任一失败都会如实返回 HTTP 状态。

## 不支持 Responses 的厂商

Codex 0.163+ 移除了 `wire_api = "chat"`。如果厂商只有 Chat Completions：

- 方案 A：用厂商提供的 Responses 兼容层（若有）；
- 方案 B：本地起一个 Responses→Chat 代理，把 `base_url` 指向代理；
- 方案 C：继续用 Chat 类工具，不要强行接进 Codex。

不要用假 `wire_api = "chat"`，新版会直接拒绝启动。

## Key 存放

- `~/.codex-for-mac/secrets/<id>.key`（0600）
- 写入 config 时只放在 `http_headers`，config 本身 0600
- 所有 CLI/UI 输出只显示 `hasKey`，不显示值
- 仓库 `.gitignore` 已屏蔽 `*.key`、`secrets/`、`.env`
