# Codex for Free v1.0.5 — 独立 macOS 应用

这是第一个可以直接双击使用的 **Codex for Free.app**，与官方 Codex 完全并存。

## 应用

- 独立 bundle：`Codex for Free.app`（bundle id `com.william.codex-for-free`）
- 不覆盖、不接管、不修改官方 Codex
- 双击自动启动本地面板并打开浏览器
- 使用隔离配置 `~/.codex-for-free`，官方继续使用 `~/.codex`

## 安装

1. 下载 `Codex-for-Free-1.0.5-macOS.zip`
2. 解压后把 `Codex for Free.app` 拖进 Applications
3. 双击启动

要求：macOS + Node.js 24。首次启动若提示找不到 Node，请先安装 Node.js 24。

## 与官方并存

- 官方 Codex：`~/.codex`，官方账号与模型
- Codex for Free：`~/.codex-for-free`，独立 provider / catalog / key
- 旧版本升级后运行 `cfm restore-official` 清理官方配置中的历史 CFM 修改
- `cfm library export --official` 可只读导入官方对话

## 验证

- App 启动后 `http://127.0.0.1:4317/api/summary` 返回 200
- 官方 app 配置无 CFM 标记，模型为 `gpt-6.1-sol`
- 隔离配置保留 DeepSeek，权限 0600
- `cfm codex exec` 在隔离环境返回 `COEXIST`
- 单元测试 11/11 通过
