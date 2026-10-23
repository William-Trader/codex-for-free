# Codex for Free v1.0.2 — 新名字，新界面

## 改名

项目正式更名为 **Codex for Free**：

- UI、About 页、README、包名、仓库地址统一更新
- 命令保留 cfm，并新增等价别名 cff
- 内部数据目录 ~/.codex-for-mac 保留，已有配置和密钥不受影响

## 界面

统一为 ChatGPT 风格：

- 中性深色背景与侧边栏式层级
- 绿色作为唯一强调色
- 扁平卡片、胶囊按钮、克制的分隔线
- 项目/对话列表对齐修正
- 去掉重复的 Codex 版本文字与不必要装饰

## 功能

v1.0.1 的全部能力保留：

- 首次启动连接模型向导（选择供应商 → API key → 测试 /responses → 保存）
- DeepSeek / Qwen / Kimi / GLM / MiniMax / OpenAI-compatible
- 本地对话 Markdown + JSON、按项目归档
- 存储体检、VACUUM、旧会话归档
- 官方 skills / plugins / marketplaces 只读保留
- key 仅存本机 0600，不回显

## 安装

    npm i -g codex-for-free-1.0.2.tgz
    cfm ui

要求：macOS + Node.js 24，已安装 Codex 应用/CLI。
