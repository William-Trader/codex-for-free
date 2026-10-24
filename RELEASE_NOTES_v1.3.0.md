# v1.3.0 — macOS + Windows 统一发布

一个版本，两个平台包。macOS 与 Windows 共用同一份 provider / 目录 / 知识库代码，
安装方式各自独立：macOS 走改名与登录跳过，Windows 不改官方应用、不绕过登录。

## 资产

| 平台 | 包 | 安装入口 |
|---|---|---|
| macOS | `Codex-for-Free-1.3.0-macOS.zip` | 双击 `Install Codex for Free.command` |
| Windows | `Codex-for-Free-1.3.0-Windows.zip` | 双击 `Install Codex for Free.cmd` 或 `powershell -ExecutionPolicy Bypass -File installer\install.ps1` |

两个包都包含 CLI 层（`bin/` + `src/`），装完即可用 `cfm`。不含任何 OpenAI 应用二进制。

## macOS

安装器会：复制官方 app 到临时目录再修改（避免 App Management 阻止写入）→ 改显示名
`Codex for Free` → 换图标 → 重签外层 bundle → 写入 DeepSeek provider 与模型目录 →
备份原 `~/.codex/config.toml` 为 `config.toml.bak-login-*`。

## Windows

官方应用**不改名、不重签、不复制、不替换**，也**不绕过** ChatGPT 登录。

1. 预检（node ≥ 24、仓库结构、官方 app 是否存在）
2. 备份 `%USERPROFILE%\.codex\config.toml` → `config.toml.bak-cfm-<时间戳>`
3. 注册 DeepSeek provider（密钥走 stdin / `CFM_KEY`，不落命令行）
4. `cfm providers sync`：从 `GET /models` 读真实上下文与 reasoning 档位
5. `cfm catalog build` → `cfm providers use deepseek --model deepseek-flash --effort high`
6. `cfm config check`：重复键/表校验 + TOML 解析
7. `cfm install-cli`：`cfm.cmd` / `cff.cmd` 装到 `%LOCALAPPDATA%\Programs\cfm`

## 两个平台共享的契约

- `model_reasoning_effort = "high"`，档位只允许 `low / high / max`（`medium` 不被 DeepSeek 接受）
- 模型目录按 `GET /models` 实测：上下文 1,048,576、最大输出 393,216、截断 60,000
- `config.toml` 必须能解析：根键不重复、`[model_providers.deepseek]` 只出现一次
- API key 只落本机受保护文件（macOS 0600 / Windows icacls 限当前用户），不进仓库与日志

## 本轮修复（来自 Windows 分支）

- `cfm.cmd` / `cff.cmd` shim 之前把 `${node}` 当字面量写入，导致 shim 永远起不来
- `cfm repair` 曾把 API key 作为命令行参数传子进程，改为环境变量
- Windows 路径进 TOML 时的反斜杠转义，并让相关测试与宿主平台无关
- README 恢复「DeepSeek 在 Codex 里的实际表现」任务测评章节

## 验证

`node --test` → 25 pass / 0 fail。macOS 侧另做端到端：`cfm doctor --json` ok、`cfm providers test deepseek`
双 200、`codex exec` 实跑改文件与执行命令通过。
