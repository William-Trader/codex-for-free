# Codex for Free · GPT 前端安装器

这是一个**本地安装器**，不是 OpenAI 应用的再分发包。

它把你已经安装的官方 **ChatGPT.app** 复制一份，改名为 **Codex for Free.app**，并写入 DeepSeek provider 配置，让 GPT 前端跳过登录、直接进入对话页。

## 需要

- macOS
- 官方 ChatGPT.app 已安装（默认路径 `/Applications/ChatGPT.app`）
- 一个 DeepSeek API key（在运行时输入，不会写入本仓库）

## 使用

1. 解压 Release 里的 `Codex-for-Free-1.1.0-Installer.zip`
2. 双击 `Install Codex for Free.command`
3. 按提示输入 DeepSeek API key
4. 安装完成后会自动打开 **Codex for Free.app**

也可以终端运行：

```bash
./install.sh
```

如果官方 app 不在默认路径：

```bash
CHATGPT_APP="/path/to/ChatGPT.app" ./install.sh
```

## 它做了什么

- 复制官方 app 到临时目录，修改显示名为 `Codex for Free`
- 使用本地图标
- 写入 `~/.codex/config.toml`：
  - 模型 `deepseek-v4-pro`
  - provider `deepseek`
  - Responses API
- 保留官方 app 的插件、skills、marketplaces 和已有数据
- 修改前自动备份 `~/.codex/config.toml.bak-login-*`
- 只把 API key 写入 0600 权限配置，不打印、不提交

## 为什么不直接挂 1.7GB 应用

当前使用的 `Codex for Free.app` 本质上是 OpenAI 的闭源 ChatGPT 应用改了本地名称。把整个 app 上传到 GitHub 属于再分发闭源应用，我不会把它作为 Release 资产上传。

这个安装器只包含我们自己的脚本、图标和模型目录；OpenAI 的应用仍由你自己安装。

## 恢复

- 官方 `ChatGPT.app` 不会被删除。
- 想恢复官方配置：把 `~/.codex/config.toml.bak-login-*` 复制回 `~/.codex/config.toml`。
- 想移除 Codex for Free：把 `/Applications/Codex for Free.app` 移到废纸篓，再恢复配置备份。

## 限制

- 官方 app 自动更新可能覆盖本地改名；更新后需要重新运行安装器。
- 登录绕过依赖自定义 provider，不适合需要 ChatGPT 账号云功能的场景。
- 仅支持 macOS。
