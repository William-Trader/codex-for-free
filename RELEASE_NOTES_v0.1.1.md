# codex for mac v0.1.1 — 发布资产对齐

这是一次小版本更新，功能与 v0.1.0 相同，主要修正发布资产与文档：

- 明确运行时要求 **Node.js >= 24**（使用内置 `node:sqlite`）。
- 文档补充与 Noesis 的关系：**不内嵌 Noesis 引擎**，导出的库是普通 Markdown/JSON，可直接作为 Noesis / Obsidian / VS Code 的知识库根目录。
- 发布 tarball 与主分支代码一致。

## 安装

```bash
npm i -g codex-for-mac-0.1.1.tgz
cfm doctor
cfm library export
cfm ui
```

## 核心能力

- 本地对话结构化保存：每条对话 `.md` + `.json`，按项目归档。
- 本地面板：浏览项目/对话、预览 Markdown、Finder 显示、一键导出。
- 模型扩展：DeepSeek（实测）、Qwen、Kimi、GLM、MiniMax、OpenAI-compatible；`cfm providers add/use/test`。
- 保留官方 Codex 框架、skills、plugins；配置只做受控块级合并。
- 存储维护：VACUUM、90 天+ 会话归档（只移不删 + manifest）。
- 安全：key 仅存 0600 文件，输出不回显；面板仅 127.0.0.1。

## 验证

- 12 条真实会话导出，3 个项目分组。
- DeepSeek `/models` 与 `/responses` 均 200；`deepseek-flash` + high effort 对话成功。
- 路径穿越被拒绝；单元测试 8/8 通过。
