# Codex for Free v1.0.4 — 与官方 Codex 并存

## 核心变化

- **独立配置目录**：Codex for Free 默认使用 `~/.codex-for-free`，官方 Codex 继续使用 `~/.codex`。
- **不再改写官方配置**：`config.toml`、模型选择、provider、catalog 全部隔离。
- **官方 app 恢复官方模型**：旧版本写入的 DeepSeek model/provider/catalog 已移除，官方 app 继续使用 OpenAI 账号与模型。
- **新增 `cfm restore-official`**：一键清理旧版本写入官方 `~/.codex/config.toml` 的修改，并自动备份。

## 使用方式

- `cfm codex ...`：使用隔离配置运行 Codex CLI。
- `cfm library export`：导出隔离会话。
- `cfm library export --official`：只读导入官方对话，索引合并，不覆盖。
- `cfm doctor`：同时显示 Free / Official 两个 home，并检查官方配置是否仍含 CFM 修改。

## 验证

- 官方 `config.toml`：无 CFM 标记、无 DeepSeek provider/catalog；模型为 `gpt-6.1-sol`。
- 隔离 `~/.codex-for-free/config.toml`：DeepSeek provider，权限 0600。
- `cfm codex exec` 在隔离配置下返回 `COEXIST`。
- 官方 app 重启后仍使用官方模型，未被覆盖。
- 本地库合并：15 个对话 / 6 个项目，官方与隔离会话并存。
- 单元测试 11/11 通过。

## 安装

    npm i -g codex-for-free-1.0.4.tgz
    cff ui

要求：macOS + Node.js 24，已安装 Codex 应用/CLI。
