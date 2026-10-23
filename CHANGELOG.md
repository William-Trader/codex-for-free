# Changelog

## 0.1.1 — 2026-10-23

- 运行时要求明确为 Node.js >= 24（使用内置 `node:sqlite`）。
- 文档补充与 Noesis 的关系：不内嵌引擎，导出普通 Markdown/JSON，可直接作为 Noesis/Obsidian 知识库。
- 发布资产与主分支对齐。

## 0.1.0 — 2026-10-23

首个公开版本。

### 新增

- `cfm library export`：把 Codex 对话按项目导出为 Markdown + 结构化 JSON，生成 `index.json`、`project.json`。
- `cfm ui`：本地 127.0.0.1 面板，浏览项目/对话、预览 Markdown、在 Finder 显示、导出、供应商管理与存储维护。
- `cfm storage report|vacuum|archive`：存储体检、SQLite VACUUM、旧会话归档（只移不删 + manifest）。
- `cfm providers`：DeepSeek / Qwen / Kimi / GLM / MiniMax / OpenAI-compatible 预设，注册、切换、Responses API 探活。
- `cfm skills`：只读列出官方 skills / plugins / marketplaces。
- `cfm doctor`：环境、存储、扩展、供应商与风险项体检。
- 受控 TOML 合并：只改 `# >>> cfm:` 标记块与根级键，保留官方配置。

### 验证

- 12 条真实 Codex 会话导出成功，3 个项目分组，Markdown/JSON 可读。
- DeepSeek `/models` 与 `/responses` 均返回 200，模型目录只含 DeepSeek 条目。
- 路径穿越请求被拒绝；单元测试 8/8 通过。
