# v1.2.1 — macOS

macOS 代码路径自 v1.2.0 起未改动。本版本存在的目的是让两个平台共用同一个版本号；
macOS 安装器与应用处理逻辑没有任何修改。

## 安装

1. 安装官方 ChatGPT for macOS 应用
2. 解压本包，双击 `Install Codex for Free.command`
3. 按提示输入自己的 DeepSeek API key

安装器会：

- 先把官方 app 复制到临时目录再修改，避免 macOS App Management 阻止写入
- 改显示名为 `Codex for Free`、换图标、重签外层 bundle
- 写入 DeepSeek provider 与模型目录
- 备份原有 `~/.codex/config.toml` 为 `config.toml.bak-login-*`

## 没有变化的部分

- provider 契约、目录生成、知识库、面板
- macOS 上的 `cfm` CLI 行为
- 登录处理（自定义 provider 跳过官方登录页）

## 同样适用的共享修复

- 库检索路径统一存 `/`（索引可跨平台）
- 解压前校验归档条目
- API key 不再出现在子进程命令行

## 要求

macOS + 已安装官方 ChatGPT 应用。无需另装 Node（用应用自带的运行时）。
