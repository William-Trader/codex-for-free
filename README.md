# Codex for Free

**给官方 Codex 客户端加上可选的 DeepSeek provider，外加本地 CLI、管理面板与对话知识库。macOS 与 Windows 双平台，同一版本号。**

当前版本：**v1.3.1**

> 官方 OpenAI 应用不进入本仓库，也不随 Release 再分发。安装器只在本机操作你已经安装的应用。

## 平台对照

| 项目 | macOS | Windows |
|---|---|---|
| 官方应用处理 | 复制并改名为 `Codex for Free.app` | **不动**：不改名、不重签、不复制 |
| 登录 | 通过自定义 provider 跳过官方登录页 | **不做登录绕过**；ChatGPT 账号功能照常可用 |
| 安装器 | `installer/install.sh` | `installer/install.ps1` |
| 需要管理员权限 | 否 | 否 |
| 写入配置 | `~/.codex/config.toml` | `%USERPROFILE%\.codex\config.toml` |
| 注册表 / 密钥 / 模型目录 | `~/.codex-for-mac/` | `%USERPROFILE%\.codex-for-mac\` |
| 密钥权限 | `chmod 600` | `icacls`：只授当前用户（等价 0600） |
| CLI 入口 | `/usr/local/bin/cfm`（符号链接） | `%LOCALAPPDATA%\Programs\cfm\cfm.cmd` |
| 备份格式 | `tar -czf` → `.tar.gz` | `Compress-Archive` → `.zip` |
| 命令补全 | `cfm completion zsh` | `cfm completion powershell` |
| 对话知识库 | `~/Documents/Codex Library` | `%USERPROFILE%\Documents\Codex Library` |

两个平台写进 `config.toml` 的契约完全一致：四个根键（`model` / `model_provider` / `model_catalog_json` / `model_reasoning_effort`）加一张 `[model_providers.deepseek]`。备份都排除 `secrets/`。

## macOS

安装器自 v1.2.0 起未改动。

1. 安装官方 ChatGPT macOS 应用
2. 使用 v1.2.0 的 `Codex-for-Free-1.2.0-Installer.zip`，或直接用仓库里的 `installer/install.sh`
3. 双击 `Install Codex for Free.command`，按提示输入自己的 DeepSeek API key

安装器会：

- 复制官方 app 到临时目录再修改，避免 macOS App Management 阻止写入
- 改显示名为 `Codex for Free`，换本地图标，重新签名外层 bundle
- 写入 DeepSeek provider 与模型目录
- 备份原有 `~/.codex/config.toml`（`config.toml.bak-login-*`）

`repair` 需要官方 `/Applications/ChatGPT.app` 存在；`uninstall` 只移动 app 并恢复配置，不删除知识库。

## Windows（v1.3.1）

**不改名、不重签、不复制、不绕登录。** 只给官方 Codex 增加一个可选的 DeepSeek provider。

    powershell -ExecutionPolicy Bypass -File installer\install.ps1

安装器按顺序做：

1. 预检（node ≥ 24、仓库结构、官方 app 是否存在）
2. 备份 `%USERPROFILE%\.codex\config.toml` → `config.toml.bak-cfm-<时间戳>`
3. 注册 provider（密钥走 stdin / `CFM_KEY`，不落命令行、不打印）
4. `cfm providers sync deepseek`：从 `GET /models` 读真实上下文与 reasoning 档位
5. `cfm catalog build` 重建模型目录
6. `cfm providers use deepseek --model deepseek-flash --effort high`
7. `cfm config check`：重复根键 / 重复表校验 + `python tomllib` 解析
8. `cfm install-cli`：写 `cfm.cmd` / `cff.cmd`，追加用户级 PATH

Release 资产：`Codex-for-Free-1.3.1-Windows.zip`。

已知限制见 [docs/WINDOWS.md](docs/WINDOWS.md)：这版 Windows build 不认 `--sandbox workspace-write`（会降级为 read-only），所以写文件/跑命令的验证是用 `danger-full-access` 做的。

## 共用命令

    cfm doctor [--json]              # 体检（环境/存储/供应商/权限）
    cfm providers list|current       # 已注册供应商 / 当前 provider 与 model
    cfm providers test [id]          # /models + /responses
    cfm providers sync <id>          # 从供应商拉真实能力
    cfm catalog build <id>           # 重建模型目录
    cfm config check                 # 校验 config.toml（重复键/表 + 解析）
    cfm search "关键词"              # 搜本地知识库
    cfm library export|list|open     # 导出 / 查看 / 打开对话库
    cfm backup                       # 备份 config + providers + 知识库（排除密钥）
    cfm restore <archive> --yes      # 恢复（先备份当前状态）
    cfm panel / cfm ui --port 4317   # 管理面板 / 本地 Web UI
    cfm codex [...args]              # 用当前配置启动 Codex CLI
    cfm install-cli [--dir DIR]      # 安装 CLI 入口
    cfm completion [zsh|bash|powershell]

平台差异只在 `install-cli`、`completion`、`repair`、`uninstall` 与备份格式上；这些命令都按 `process.platform` 分支，不需要手动加参数。

## 模型目录必须和供应商对齐

DeepSeek 的实际能力（`GET /models`，2026-10-24 实测）：

| 项 | deepseek-flash | deepseek-v4-pro |
|---|---|---|
| 上下文 | 1,048,576 | 1,048,576 |
| 最大输出 | 393,216 | 393,216 |
| reasoning 档位 | low / high / max（默认 high） | low / high / max（默认 high） |
| 输入模态 | text + image | text |

早期目录把上下文写成 131,072、档位写成 `low/medium/high`，会导致上下文被提前截断、`medium` 是 API 不认的档位。现在 `cfm providers sync` 会把真实值写回注册表，`cfm catalog build` 据此重建目录，`cfm providers use` 会拒绝供应商不支持的 effort。

## 仓库结构

    .
    ├── installer/
    │   ├── install.sh            # macOS 安装器（v1.3.x 未改动）
    │   ├── install.ps1           # Windows 安装器
    │   ├── Install Codex for Free.command
    │   ├── AppIcon.icns
    │   └── catalog/deepseek.json
    ├── bin/cfm.mjs               # CLI 入口（Windows 下自动切 UTF-8 控制台）
    ├── src/                      # provider / 目录 / 面板 / 库 / 维护逻辑
    ├── public/                   # 面板前端
    ├── docs/
    │   ├── ARCHITECTURE.md
    │   ├── KNOWLEDGE_BASE.md
    │   ├── OPERATIONS.md
    │   └── WINDOWS.md            # Windows 实测矩阵与已知限制
    ├── test/                     # node --test（25 项）
    └── .github/workflows/ci.yml

## 边界

- **macOS**：登录绕过依赖自定义 provider；ChatGPT 账号云功能、Cloud 任务、远程控制不可用是预期结果。官方 app 更新可能覆盖改名与配置，更新后重跑安装器。
- **Windows**：不改官方应用，账号功能保留；但自定义 provider 下仍无法使用 OpenAI 的图像生成、Cloud 任务等账号能力。桌面端首次启动有一次问卷，需人工点选。
- 两个平台都**不承诺模型能力对等**：DeepSeek 不支持 OpenAI 的图像生成、部分语音/账号能力。
- GPT 前端不内嵌本地面板/知识库；这是刻意隔离。

## 开发

    node --test
    node --check src/*.mjs
    zsh -n installer/install.sh
    powershell -NoProfile -Command "[void][ScriptBlock]::Create((Get-Content installer/install.ps1 -Raw))"

CI：`.github/workflows/ci.yml`。

## License

MIT。安装器脚本和本项目代码开源；OpenAI ChatGPT/Codex 应用遵循其自身许可，不包含在本仓库中。
