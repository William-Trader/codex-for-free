# Codex for Mac v1.0 — 给不想用终端的人

**Powered by William**

这是第一个正式版。目标很简单：让 Codex 不再只是终端里的工具，而是一个打开浏览器就能用的产品。

## v1 亮点

- **图形化入口**：双击 `start.command` 或运行 `cfm ui`，浏览器里完成所有操作。
- **关于页 / 个人信息**：`/about` 与面板内 About 弹窗，包含 William 头像、Powered by William、版本、发布日期与 GitHub 链接。
- **新手引导**：空库时显示三步上手卡片（导出 → 接入模型 → 归档）。
- **本地对话库**：每条对话 `.md` + `.json`，按项目归档，Finder 一键定位。
- **模型扩展**：DeepSeek / Qwen / Kimi / GLM / MiniMax / OpenAI-compatible，带 Responses API 探活。
- **保留官方框架**：skills / plugins / marketplaces 只读展示，配置只做受控块级合并。
- **存储维护**：VACUUM、90 天+ 会话归档（只移不删 + manifest）。

## 安装

```bash
npm i -g codex-for-mac-1.0.0.tgz
cfm ui
```

或双击仓库里的 `start.command`。

要求：macOS + Node.js 24，已安装 Codex 应用/CLI。

## 验证

- 12 条真实 Codex 会话导出，3 个项目分组。
- DeepSeek `/models` 与 `/responses` 均 200；`deepseek-flash` + high effort 对话成功。
- 路径穿越请求被拒绝；单元测试全部通过；CI 绿色。
- 仓库、提交历史、发布资产均无 API key。

## 说明

Codex 桌面端是 OpenAI 的闭源应用，本项目不修改、不重打包、不分发它；这里发布的是我们自己的图形化前端与本地数据工具。
