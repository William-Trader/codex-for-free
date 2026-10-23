# codex for mac v0.1.0 — 自主模型扩展

首个公开版本：把 Codex 的本地对话、项目文件夹和模型接入，做成一套可浏览、可迁移、可维护的本地系统。

## 亮点

- **结构化对话保存**：每条对话同时生成 `.md`（阅读）与 `.json`（程序处理），按项目归档到普通文件夹，带 `index.json` / `project.json`。
- **本地面板**：`cfm ui` 在 127.0.0.1 浏览项目与对话、预览 Markdown、在 Finder 显示、导出全部对话。
- **模型自主扩展**：DeepSeek（实测可用）、Qwen、Kimi、GLM、MiniMax、任意 OpenAI-compatible 端点；`cfm providers add/use/test`。
- **保留官方框架**：只读展示官方 skills / plugins / marketplaces；只对 `config.toml` 做受控块级合并。
- **存储维护**：占用体检、SQLite VACUUM、90 天+ 会话归档（只移不删 + manifest）。
- **安全**：key 仅存 `~/.codex-for-mac/secrets/*.key`（0600），输出不回显；路径穿越校验；面板仅本机。

## 安装

```bash
npm i -g codex-for-mac-0.1.0.tgz
cfm doctor
cfm library export
cfm ui
```

或从源码：

```bash
git clone https://github.com/William-Trader/codex-for-mac.git
cd codex-for-mac && npm link
```

要求 Node.js >= 24，已安装 Codex 应用/CLI。

## 实测

- 12 条真实 Codex 会话导出，3 个项目分组，Markdown/JSON 可读。
- DeepSeek `/models`、`/responses` 均 200；`deepseek-v4-pro` / `deepseek-flash` 对话成功。
- 路径穿越请求返回 `path outside library`。
- 单元测试 8/8 通过。

## 边界

- Codex 0.163+ 只接受 Responses API；不支持 `/responses` 的厂商需自建代理。
- 不包含、不重打包、不分发 OpenAI 的 Codex 桌面应用；仅操作本机 `~/.codex` 用户数据。
- 本项目代码 MIT；第三方声明见 NOTICE。
