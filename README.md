# Codex for Free

**一个本地化的 GPT 前端入口，外加可选的本地知识库和 provider 面板。**

当前项目由两层组成：

1. **GPT 前端安装器**：把本机已经安装的官方 `ChatGPT.app` 复制并改名为 `Codex for Free.app`，写入 DeepSeek provider，跳过登录页。
2. **本地工具层**：保留 `cfm` 命令、管理面板和对话知识库，用命令打开，不干扰 GPT 前端。

> 官方 OpenAI 应用不进入本仓库，也不随 Release 再分发。安装器只在本机操作你已经安装的应用。

## 快速开始

### 使用 GPT 前端

1. 安装官方 ChatGPT macOS 应用
2. 下载 Release 里的 `Codex-for-Free-1.1.1-Installer.zip`
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
cfm providers test deepseek
cfm providers use deepseek --model deepseek-v4-pro --effort medium
cfm panel
```

API key 只保存在本机 0600 文件或 `~/.codex/config.toml` 的请求头里，不进入仓库、日志或回复。

## 边界

- **登录绕过**依赖自定义 provider；ChatGPT 账号云功能、Cloud 任务、远程控制等不可用是预期结果。
- **官方 app 更新**可能覆盖本地改名和配置；更新后需要重新运行安装器。
- **GPT 前端不内嵌**本地面板/知识库；这是刻意隔离，避免修改官方 UI。
- **不承诺模型能力对等**：DeepSeek 不支持 OpenAI 的图像生成、部分语音/账号能力。
- 仅支持 macOS。

## 开发

```bash
node --test
node --check src/*.mjs
zsh -n installer/install.sh
```

CI：`.github/workflows/ci.yml`。

## License

MIT。安装器脚本和本项目代码开源；OpenAI ChatGPT.app 遵循其自身许可，不包含在本仓库中。
