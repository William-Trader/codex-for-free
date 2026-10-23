# codex for mac — 自主模型扩展

把 Codex 的**本地对话**、**项目文件夹**和**模型接入**做成一套可浏览、可迁移、可维护的本地系统；保留官方 Codex 框架、skills、plugins 与 marketplace，不修改、不重打包官方应用。

> 本项目只包含我们自己的代码（MIT）。Codex CLI 属于 OpenAI（Apache-2.0），Codex/ChatGPT 桌面应用为闭源专有软件；本项目**不包含也未重新分发**它们的源码或二进制。

## 为什么做这个

Codex 在 macOS 上把会话散落在 `~/.codex/sessions/*.jsonl`、`state_5.sqlite`、`thread_history_1.sqlite` 里：能跑，但不好找、不好读、不好带走。

codex-for-mac 做三件事：

1. **本地对话结构化保存**：把每个对话导出成同名 `.md`（给人看）和 `.json`（给程序看），按项目归档到普通文件夹。
2. **项目文件夹一眼可见**：项目、路径、对话数量、失效路径都能在面板里看到，一键在 Finder 显示。
3. **模型自主扩展**：DeepSeek、Qwen、Kimi、GLM、MiniMax 与任意 OpenAI-compatible 端点，统一注册、切换、测试；智能程度可调。

## 功能

| 模块 | 能力 |
|---|---|
| `cfm library` | 导出/浏览本地对话库；按项目分组；结构化 JSON + Markdown；索引 `index.json` |
| `cfm storage` | 存储体检、SQLite VACUUM、90 天+ 会话归档（只移不删，带 manifest） |
| `cfm folders` | 项目路径体检：缺失、重复 |
| `cfm skills` | 只读列出官方 skills / plugins / marketplaces |
| `cfm providers` | 预设 + 自定义供应商；key 本地 0600；一键设为默认；Responses API 探活 |
| `cfm ui` | 本地面板（127.0.0.1），浏览项目/对话、预览 Markdown、管理供应商与存储 |
| `cfm doctor` | 一屏体检：环境、存储、扩展、供应商、风险项 |

## 安装

要求：macOS、Node.js >= 22.5（使用内置 `node:sqlite`）、已安装 Codex 应用或 Codex CLI。

```bash
git clone https://github.com/William-Trader/codex-for-mac.git
cd codex-for-mac
npm link           # 或 node bin/cfm.mjs
cfm doctor
```

## 快速开始

```bash
# 1. 把现有对话导出成可浏览的本地库
cfm library export
cfm library open

# 2. 启动面板
cfm ui

# 3. 接入 DeepSeek（已验证）
cfm providers add deepseek --key-stdin
cfm providers use deepseek
cfm providers test deepseek
```

> `--key-stdin` 从标准输入读 key：`pbpaste | cfm providers add deepseek --key-stdin`。也可以交互式输入（不回显）或使用 `CFM_KEY` 环境变量。key 只写入 `~/.codex-for-mac/secrets/<id>.key`（0600），不会打印，也不会进入仓库。

## 接入 Qwen 等厂商

```bash
cfm providers presets                 # 查看预设
cfm providers add qwen --key-stdin    # DashScope 兼容模式
cfm providers use qwen --model qwen3-max --effort high

cfm providers add openai-compatible \
  --id mylab --base-url https://example.com/v1 \
  --models my-model-a,my-model-b --key-stdin
cfm providers use mylab --model my-model-a
```

**重要**：Codex 0.163+ 只接受 **Responses API**（`wire_api = "responses"`）。供应商必须提供 `POST {baseUrl}/responses`，否则需要自建一个 Responses→Chat Completions 代理。`cfm providers test` 会分别探测 `/models` 与 `/responses`，如实告诉你能否直接用于 Codex。

已在本机实测：DeepSeek `https://api.deepseek.com/v1` 的 `/responses` 可用，`deepseek-v4-pro` / `deepseek-flash` 均可对话。Qwen 等预设是配置模板，是否可直连取决于其 Responses 支持情况与你的账号权限。

## 本地对话库长什么样

```
~/Documents/Codex Library/
├── index.json                     # 项目 + 对话总索引
├── _README.md
├── projects/
│   └── demo-1a2b3c/
│       ├── project.json           # 名称、路径、是否失效
│       └── conversations/
│           ├── 20261023-hello-01a1678a.md
│           └── 20261023-hello-01a1678a.json
└── inbox/                         # 未归属项目的对话
```

- `.md`：标题、项目、模型、时间、逐条消息，可直接用 Finder / Obsidian / VS Code 阅读。
- `.json`：`codex-for-mac/conversation@1` schema，字段稳定，便于脚本处理。
- 导出前会做密钥脱敏（`sk-*`、`Bearer *`、GitHub token 等）。
- 重跑是幂等的：默认跳过已存在文件，`--force` 覆盖。
- 删除这个目录**不会影响 Codex 本体**，随时可重新导出。

## 安全与隐私

- 仓库内没有任何 API key、cookie 或用户数据；`.gitignore` 屏蔽 `.env`、`*.key`、`secrets/`。
- key 存放：`~/.codex-for-mac/secrets/<provider>.key`，目录 0700 / 文件 0600。
- 写入 Codex 的配置是 `~/.codex/config.toml`（0600），只做**块级合并**，不整文件覆盖；原有 `[desktop]`、plugins、marketplaces、MCP 配置保留。
- 面板只监听 `127.0.0.1`，不对外网开放；API 不返回 key，只返回 `hasKey`。
- 归档只移动不删除，并写 manifest；跨卷时复制并保留原件。

## 开发

```bash
npm test
node bin/cfm.mjs doctor
node bin/cfm.mjs ui --no-open
```

零运行时依赖，使用 Node 内置 `http`、`node:sqlite`、`child_process`。

## 边界

- 不修改、不重打包、不分发 Codex 桌面应用。
- 不承诺所有厂商都能直连：Codex 的 Responses API 要求是硬约束。
- 本地库是 Codex 数据的**派生副本**，不是 Codex 的唯一数据源。

## License

MIT（本项目代码）。第三方声明见 [NOTICE](NOTICE)。
