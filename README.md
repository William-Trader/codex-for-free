# Codex for Free · macOS

**把已经安装的官方 GPT 前端，在本机变成 Codex for Free。**

当前 Release 提供的是一个本地安装器：复制官方 `ChatGPT.app`，改名为 `Codex for Free.app`，写入 DeepSeek provider 配置，跳过登录页，直接进入 GPT 对话前端。

## 下载与安装

Release 资产：

```text
Codex-for-Free-1.1.0-Installer.zip
```

使用步骤：

1. 先安装官方 **ChatGPT.app**（默认路径 `/Applications/ChatGPT.app`）
2. 解压安装器
3. 双击 `Install Codex for Free.command`
4. 输入 DeepSeek API key
5. 安装完成后自动打开 `Codex for Free.app`

终端方式：

```bash
./install.sh
# 官方 app 不在默认路径时
CHATGPT_APP="/path/to/ChatGPT.app" ./install.sh
```

## 为什么不直接上传 1.7GB 应用

当前正在使用的 `Codex for Free.app` 是 **OpenAI 闭源 ChatGPT 应用**的本地改名版本。把整个 app 放进 GitHub Release 属于再分发闭源应用，不能这样做。

所以 Release 只包含：

- 本地安装/改名脚本
- 图标
- DeepSeek 模型目录
- 配置合并逻辑

官方 app 由使用者自己安装，安装器只在本地操作。

## 安装器做了什么

- 把官方 app 复制到临时目录再修改，避免 macOS App Management 阻止写入
- 修改显示名为 `Codex for Free`
- 替换本地图标
- 重新签名外层 app bundle
- 写入 `~/.codex/config.toml` 的 DeepSeek provider 配置
- 保留官方插件、skills、marketplaces 和已有数据
- 修改配置前自动备份
- API key 只写入 0600 权限配置，不进入仓库、日志或回复

## 登录绕过

安装器配置：

```toml
model = "deepseek-v4-pro"
model_provider = "deepseek"
model_catalog_json = "~/.codex-for-mac/catalog/deepseek.json"
model_reasoning_effort = "medium"

[model_providers.deepseek]
name = "DeepSeek"
base_url = "https://api.deepseek.com/v1"
wire_api = "responses"
```

官方前端会使用自定义 provider，不再要求 ChatGPT 登录。`codex login status` 仍可能显示“未登录”，这是预期行为。

## 恢复官方状态

- 官方 `ChatGPT.app` 不会被安装器删除。
- 配置备份：`~/.codex/config.toml.bak-login-*`
- 恢复：把备份复制回 `~/.codex/config.toml`
- 移除前端：把 `/Applications/Codex for Free.app` 移到废纸篓

## 限制

- 官方 app 自动升级可能覆盖本地改名，升级后需要重新运行安装器。
- 仅支持 macOS。
- 登录绕过依赖自定义 provider，不适用于必须使用 ChatGPT 账号云功能的场景。

## 工程结构

```text
installer/
├── install.sh
├── Install Codex for Free.command
├── README.md
├── AppIcon.icns
└── catalog/deepseek.json
```

早期自研面板源码仍保留在 `src/`、`public/`，当前 Release 采用 GPT 前端安装器方案。

## 安全

- 仓库不包含 API key、cookie 或用户数据。
- key 只写入 `~/.codex/config.toml`（0600）。
- 安装器不联网上传任何数据。
- 官方 app 的本地修改只用于本机，不对外分发。

## License

MIT（本项目安装器与脚本代码）。OpenAI ChatGPT.app 不包含在本仓库中，遵循其自身许可。
