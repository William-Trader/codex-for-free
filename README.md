# Codex for Free

**一个本地化的 GPT 前端入口，外加可选的本地知识库和 provider 面板。**

当前项目由两层组成：

1. **GPT 前端安装器**：把本机已经安装的官方 `ChatGPT.app` 复制并改名为 `Codex for Free.app`，写入 DeepSeek provider，跳过登录页。
2. **本地工具层**：保留 `cfm` 命令、管理面板和对话知识库，用命令打开，不干扰 GPT 前端。

> 官方 OpenAI 应用不进入本仓库，也不随 Release 再分发。安装器只在本机操作你已经安装的应用。

## Windows（v1.3.0）

Windows 上**不改名、不重签、不复制官方应用**，也**不做登录绕过**：只给官方
Codex 增加一个可选的 DeepSeek provider，GPT 账号功能照常可用。

```powershell
powershell -ExecutionPolicy Bypass -File installer\install.ps1
```

安装器会：备份 `%USERPROFILE%\.codex\config.toml` → 写入 provider →
从 `/models` 同步真实能力 → 重建模型目录 → 校验 TOML → 安装 `cfm.cmd`。

- CLI：`%LOCALAPPDATA%\Programs\cfm\cfm.cmd`（用户级 PATH，无需管理员）
- 目录/密钥：`%USERPROFILE%\.codex-for-mac\`（与 macOS 同名，减少分叉）
- 密钥权限：`icacls` 只授当前用户（等价 0600）
- 备份：`Compress-Archive` → `.zip`

细节与实测记录见 [docs/WINDOWS.md](docs/WINDOWS.md)。

## 快速开始

### 使用 GPT 前端

1. 安装官方 ChatGPT macOS 应用
2. 下载 Release 里的 `Codex-for-Free-1.2.0-Installer.zip`
3. 解压后双击 `Install Codex for Free.command`
4. 输入自己的 DeepSeek API key

安装器会：

- 复制官方 app 到临时目录再修改，避免 macOS App Management 阻止写入
- 改显示名为 `Codex for Free`
- 写入 DeepSeek provider 和模型目录
- 备份原有 `~/.codex/config.toml`
- 重新签名外层 app bundle

### 打开本地面板和知识库

`Codex for Free.app` 本身是 GPT 前端；本地面板和知识库是独立命令：

```bash
cfm panel       # 打开管理面板
cfm knowledge   # 在 Finder 打开知识库
cfm library list
cfm providers list
```

也可以双击桌面上的：

```text
打开 Codex for Free 面板.command
打开 Codex for Free 知识库.command
```

### 维护命令

```bash
cfm search "关键词"          # 搜知识库 Markdown
cfm backup                   # 备份 config + providers + 知识库
cfm restore <archive> --yes  # 恢复备份（先备份当前状态）
cfm repair                   # 官方 app 更新后重做改名与配置
cfm uninstall --yes          # 移走 app，恢复官方配置
cfm providers current        # 当前 provider / model
cfm providers test           # 测全部 provider
cfm completion zsh           # 输出 zsh 补全
```

`repair` 需要官方 `/Applications/ChatGPT.app` 存在；`uninstall` 只移动 app 并恢复配置，不删除知识库。

## 仓库结构

```text
.
├── installer/                 # GPT 前端本地安装器（Release 资产）
│   ├── install.sh
│   ├── Install Codex for Free.command
│   ├── AppIcon.icns
│   └── catalog/deepseek.json
├── bin/                       # cfm CLI 入口
├── src/                       # 本地面板、provider、库管理逻辑
├── public/                    # 面板前端
├── macapp/                    # 早期独立 app 包装（历史保留）
├── docs/
│   ├── ARCHITECTURE.md
│   ├── KNOWLEDGE_BASE.md
│   └── OPERATIONS.md
├── scripts/build-app.sh
└── .github/workflows/ci.yml
```

## 知识库

精简后的默认结构：

```text
~/Documents/Codex Library/
├── INDEX.md                    # 人类可读索引
├── index.json                  # 程序索引
├── projects/
│   └── codex-for-mac-1172ca/
│       ├── project.json
│       └── conversations/*.md, *.json
├── inbox/
└── _archive/
    ├── manifest.csv
    └── test-projects-20261023/
```

- 每条对话保留 `.md`（阅读）和 `.json`（程序读取）。
- 测试对话已移动到 `_archive/test-projects-20261023/`，没有删除。
- 恢复映射在 `_archive/manifest.csv`。
- 详细说明见 [docs/KNOWLEDGE_BASE.md](docs/KNOWLEDGE_BASE.md)。

常用查找：

```bash
rg -n "关键词" ~/Documents/Codex\ Library
find ~/Documents/Codex\ Library/projects -name '*.md'
cfm library list
```

## Provider

当前默认 provider 为 DeepSeek，配置在 `~/.codex/config.toml`：

```toml
model = "deepseek-v4-pro"
model_provider = "deepseek"
model_catalog_json = "~/.codex-for-mac/catalog/deepseek.json"
```

管理命令：

```bash
cfm providers list
cfm providers sync deepseek        # 从 /models 拉真实上下文长度与 reasoning 档位
cfm providers test deepseek
cfm providers use deepseek --model deepseek-flash --effort high
cfm panel
```

API key 只保存在本机 0600 文件或 `~/.codex/config.toml` 的请求头里，不进入仓库、日志或回复。

### 模型目录必须和供应商对齐

DeepSeek 的实际能力（`GET /models`，2026-10-24）：

| 项 | deepseek-flash | deepseek-v4-pro |
|---|---|---|
| 上下文 | 1,048,576 | 1,048,576 |
| 最大输出 | 393,216 | 393,216 |
| reasoning 档位 | low / high / max（默认 high） | low / high / max（默认 high） |
| 输入模态 | text + image | text |

早期目录把上下文写成 131,072、档位写成 `low/medium/high`，导致上下文被提前截断、`medium` 是一个 API 不认的档位。现在 `cfm providers sync` 会把真实值写回注册表，`cfm catalog build` 据此重建目录，`cfm providers use` 会拒绝供应商不支持的 effort。

## DeepSeek 在 Codex 里的实际表现

以下是 2026-10-24 在本机实际跑出来的结果，`codex-cli 0.163.0-alpha.11.2` + `deepseek-flash` + effort `high`，全部为真实执行、非模拟：

| # | 任务 | 耗时 | 结果 |
|---|---|---:|---|
| T1 | 单轮问答（复式记账） | 2.1s | 正确，未误调工具 |
| T2 | 读文件定位 bug | 4.0s | 指出第 2 行 `a - b`，未修改文件 |
| T3 | 改文件 + 运行验证 | 16.2s | 只改一行，实跑输出 5 |
| T4 | 新建脚本 + 管道运行 | 8.9s | 脚本正确，贴出的输出与实跑一致 |
| T5 | 请求不存在的文件 | 8.0s | 先探测再明确报缺失，没有编造内容 |
| T8 | 180 KB / 4000 行长文件定位 | 8.8s | 命中第 3124 行，未整文件硬读 |
| T9 | 多文件重构 + 测试 | 15.3s | 改 `util.py` + 补断言，`python3 test_app.py` 通过 |
| T10 | 两路并发 | 6.6s / 11.4s | 两路都正确，互不干扰 |

reasoning 档位实测（同一道可验证的算术题）：

| effort | tokens | 耗时 | 正确 |
|---|---:|---:|---|
| low | 447 | 7.0s | 是 |
| high | 452 | 6.7s | 是 |
| max | 11,513 | 8.9s | 是 |

结论：**effort 确实传到了 API**（max 的思考 token 是 low 的 25 倍），但在这种题上不改变答案，只增加成本。日常用 `high`；只有难题再上 `max`。

任务质量判断：

- **可靠**：读写文件、单点修复、跑命令验证、按关键词检索、单文件重构、并发短任务。全程没有出现工具调用死循环，也没有伪造执行结果（T4 贴的输出与实跑一致，T5 明确说文件不存在）。
- **需要注意**：它会严格按字面实现需求。T9 里要求的“空格或下划线”被实现为 `[ _]+`，连字符不在其中，所以 `A_-_B` → `a---b`。这不是 bug，是需求没写全；给它更明确的规格即可。
- **未验证**：超大仓库（数千文件）全局重构、长时间多轮会话的上下文稳定性、图像理解（`deepseek-flash` 声明支持图片输入，但本项目未做图像链路测试）。

## 边界

- **登录绕过**依赖自定义 provider；ChatGPT 账号云功能、Cloud 任务、远程控制等不可用是预期结果。
- **官方 app 更新**可能覆盖本地改名和配置；更新后需要重新运行安装器。
- **GPT 前端不内嵌**本地面板/知识库；这是刻意隔离，避免修改官方 UI。
- **不承诺模型能力对等**：DeepSeek 不支持 OpenAI 的图像生成、部分语音/账号能力。
- macOS 与 Windows（v1.3.0 起）；Windows 不包含改名/重签/登录绕过。

## 开发

```bash
node --test
node --check src/*.mjs
zsh -n installer/install.sh
```

CI：`.github/workflows/ci.yml`。

## License

MIT。安装器脚本和本项目代码开源；OpenAI ChatGPT.app 遵循其自身许可，不包含在本仓库中。
