# v1.2.1 — Windows

Windows 支持。官方 Codex 应用**不改名、不重签、不复制、不替换**，也**不绕过** ChatGPT 登录。

## 安装

    powershell -ExecutionPolicy Bypass -File installer\install.ps1

或双击 `installer\Install Codex for Free.cmd`。无需管理员权限。

## 它做了什么

1. 预检（node ≥ 24、仓库结构、官方 app 是否存在）
2. 备份 `%USERPROFILE%\.codex\config.toml` → `config.toml.bak-cfm-<时间戳>`
3. 注册 DeepSeek provider（密钥走 stdin / `CFM_KEY`，不落命令行）
4. `cfm providers sync`：从 `GET /models` 读真实上下文与 reasoning 档位
5. `cfm catalog build`
6. `cfm providers use deepseek --model deepseek-flash --effort high`
7. `cfm config check`：重复键/表校验 + `python tomllib` 解析
8. `cfm install-cli`：`cfm.cmd` / `cff.cmd` 装到 `%LOCALAPPDATA%\Programs\cfm`

## 在 Windows 11（10.0.26300）实测

| 检查 | 结果 |
|---|---|
| `cfm doctor --json` | ok，codex-cli 0.163.0-alpha.10.2，config acl-private |
| `cfm providers test deepseek` | /models 200、/responses 200、2 个模型 |
| 模型目录 | ctx 1,048,576，effort low/high/max，默认 high |
| `cfm config check` | 无重复键；tomllib 解析通过 |
| `codex exec` 单轮 | 391 / 6.4s |
| `codex exec` 改文件并运行 | 修好运算符，实跑 5 / 17.1s |
| `codex exec` 建脚本并运行 | 336，独立复跑 336 / 13.6s |
| `cfm backup` → `cfm restore` | 21 条目、0 条 secrets、配置仍可解析 |
| `node --test` | 25 通过 / 0 失败 |

## 本版修复

- `cfm.cmd` 含字面量 `"${node}"`，之前根本无法启动
- `cfm repair` 把 API key 暴露在子进程命令行
- `cfm ui` 调 macOS `open` 导致 `spawn ENOENT` 崩溃
- 936 控制台下中文乱码
- 恢复前未校验归档条目

## 已知限制

- 这版 Windows build 不认 `--sandbox workspace-write`（降级为 read-only），写文件/跑命令的验证用 `danger-full-access`；Windows 沙箱未验证
- 桌面端首次启动的问卷需要人工点一次（MSIX 窗口拒绝注入输入）
- `deepseek-flash` 声明的图片输入未做端到端验证
