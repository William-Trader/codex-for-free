# Codex for Free · macOS

**给不想碰终端的人：一个图形化的 Codex 入口。**

双击启动 → 浏览器面板 → 选模型 → 聊天记录自动按项目保存。  
不需要记命令，不需要翻 `~/.codex` 里散落的 JSONL。

<p align="center"><b>Powered by William</b></p>

## 平台支持

- **本仓库当前发布的是 macOS 版本**，功能与更新优先。
- **Windows 版本将在几天内推出**；发布后，Windows 版本的更新节奏会慢于 macOS。
- macOS 版本会继续作为主平台，优先获得新功能、兼容性修复与模型接入更新。

## 与官方 Codex 并存

- 官方 Codex 使用 `~/.codex`；Codex for Free 默认使用 `~/.codex-for-free`。
- 本工具不再改写官方 `config.toml`；旧版本升级后运行 `cfm restore-official` 清除历史修改。
- `cfm codex ...` 使用隔离配置；官方 app 继续使用官方账号与模型。
- `cfm library export` 默认导出隔离会话，`--official` 只读导入官方对话，索引会合并。
- 官方 Skills / Plugins / Marketplaces 只读展示，不会被修改。

## 直接下载 macOS 应用

- Release 里的 `Codex-for-Free-1.0.5-macOS.zip` 解压后拖进 Applications，双击启动。
- 独立 bundle id，不会覆盖或接管官方 Codex。
- 应用只负责启动本地面板；官方 Codex 继续独立运行。

## 30 秒开始（小白版）

1. 安装 **Node.js 24**：<https://nodejs.org>
2. 下载 Release 里的 `codex-for-free-1.0.5.tgz`，或克隆本仓库
3. 任选一种启动方式：

```bash
# A. 双击 start.command（macOS，最省事）
# B. 终端安装
npm i -g codex-for-free-1.0.5.tgz
cfm ui
```

浏览器会自动打开 `http://127.0.0.1:4317`。

> 第一次打开会自动进入「先把模型接上」向导：选供应商 → 粘贴 API key → 测试 /responses → 保存并进入。key 只写本机 0600 文件；只发送给你选择的供应商。

## 为什么是 v1

v0.x 是能用的工具；v1 是给普通人的产品。

| 以前的 Codex | Codex for Free v1 |
|---|---|
| 只会在终端里跑 | 浏览器面板，点按钮就行 |
| 对话散在 `~/.codex` | 按项目归档成 Markdown / JSON |
| 找历史要翻文件 | 左侧项目、右侧对话、点开即读 |
| 换模型要手改 TOML | 供应商页面注册 / 切换 / 探活 |
| 不知道怎么清理 | 存储体检、VACUUM、旧会话归档 |

## 面板里有什么

- **对话**：按项目浏览，Markdown 预览，一键在 Finder 显示。
- **模型供应商**：DeepSeek（实测可用）、Qwen、Kimi、GLM、MiniMax、任意 OpenAI-compatible；带 `/models` 与 `/responses` 探活。
- **存储**：Codex 占用、SQLite 压缩、90 天+ 会话归档（只移不删）。
- **扩展**：只读展示官方 skills / plugins / marketplaces。
- **关于**：William 的个人信息、头像、版本与发布信息（`/about`）。

## 本地对话库

```
~/Documents/Codex Library/
├── index.json
├── projects/<项目名>-<hash>/
│   ├── project.json
│   └── conversations/
│       ├── 20261023-标题-id.md
│       └── 20261023-标题-id.json
└── inbox/
```

- 每条对话两份：`.md` 给人看，`.json` 给程序读。
- 重跑幂等，默认跳过已有文件；`--force` 覆盖。
- 删除这个目录不影响 Codex 本体，重新导出即可。
- 不内嵌 Noesis 引擎；普通文件格式可直接作为 Noesis / Obsidian / VS Code 的知识库。

## 模型接入

```bash
cfm providers presets
cfm providers add deepseek --key-stdin
cfm providers use deepseek --model deepseek-flash --effort high
cfm providers test deepseek
```

**硬约束**：Codex 0.163+ 只接受 **Responses API**（`/responses`）。Qwen 等预设是否可直连取决于厂商；`cfm providers test` 会分别探测 `/models` 与 `/responses`，失败会明确提示，不用假配置硬接。

## 安全与隐私

- 仓库不包含 API key、cookie、用户数据或本机路径。
- key 存在 `~/.codex-for-mac/secrets/<id>.key`（目录 0700 / 文件 0600），只在 `config.toml`（0600）的 `http_headers` 中使用，输出不回显。
- 面板只监听 `127.0.0.1`；文件接口校验路径必须在本地库内。
- 归档只移动不删除，跨卷时复制并保留原件。

## 关于作者

- 作者：**William**（GitHub：[@William-Trader](https://github.com/William-Trader)）
- 头像：`public/avatar.svg`，替换成自己的图片后重启面板即可。
- 关于页：`http://127.0.0.1:4317/about`

## 技术要求

- macOS
- Node.js >= 24（使用内置 `node:sqlite`）
- 已安装 Codex 应用或 Codex CLI

## 边界

- 不修改、不重打包、不分发 OpenAI 的 Codex 桌面应用。
- 不承诺所有厂商都能直连：Responses API 是硬约束。
- 本地库是 Codex 数据的派生副本，不是唯一数据源。

## License

MIT（本项目代码）。第三方声明见 [NOTICE](NOTICE)。
