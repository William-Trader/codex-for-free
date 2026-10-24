## v1.3.0 — 2026-10-24 — 统一发布：Windows 支持 + macOS 同步

- 新增 Windows 安装器 `installer/install.ps1`：只增不改，不改名、不重签、不复制官方应用，不绕过登录
- Windows：`cfm.cmd` / `cff.cmd` 入口装到 `%LOCALAPPDATA%\Programs\cfm`，用户级 PATH，无需管理员
- Windows：密钥与 config 用 `icacls` 收窄到当前用户（等价 0600），`doctor` 报 `acl-private`
- Windows：备份改用 `Compress-Archive` 且排除 `secrets/`；恢复前校验条目（绝对路径/盘符/`..`）
- Windows：`locateCodex()` 发现 `%LOCALAPPDATA%\OpenAI\Codex\bin\<hash>\codex.exe` 并取最新；`which()` 支持 `PATHEXT`
- Windows：控制台为 936 时自动切 65001，退出恢复，中文不再乱码
- 新增 `cfm config check`（重复根键/重复表 + `python tomllib`）、`cfm completion powershell`
- 修复 `cfm.cmd` 生成字面量 `"${node}"` 导致 shim 不可用
- 修复 `cfm repair` 把 API key 放进子进程命令行
- 修复 `cfm ui` 在 Windows 调 `open` 导致 `spawn ENOENT` 崩溃
- 库检索结果统一用 `/`，索引在 macOS / Windows 间可移植
- 测试：TOML 转义用例改用字面量 Windows 路径，测试不再依赖宿主平台
- macOS：安装器与 app 处理逻辑未改动

## v1.2.0 — DeepSeek 能力对齐

- catalog 按 /models 真实声明上下文 1,048,576、输出 393,216、模态
- reasoning 档位改为 low/high/max，默认 high
- 修复 providers use 写出重复根键与重复 provider 表（非法 TOML）
- 截断上限按上下文自适应
- cfm codex 参数全量透传
- 新增 providers sync；README 增加真实任务测评

## v1.1.3 — 实际使用修复

- CLI 安装到 PATH（cfm install-cli + 安装器链接）
- 修复 Codex CLI 检测（改名 app 找不到内置 CLI）
- 修复 CODEX_HOME 指向废弃目录（provider 切换无效）
- search 自动同步知识库；归档项目不再复活
- 官方 app 缺失时 repair 可用前端自身重建

## v1.1.2 — 完整性收尾

- 全量验证与文档矩阵
- providers test JSON 输出修复
- installer key 生成测试

## v1.1.1 — 维护工具补齐

- search / backup / restore / repair / uninstall
- doctor --json、providers current/test、completion
- 安装器 key 与 reasoning 修复

## v1.1.0 — GPT 前端安装器

- 新增 `installer/`：把官方 ChatGPT/Codex 前端本地安装为 Codex for Free
- 本地改名、图标、DeepSeek provider 与登录绕过
- 安装前备份 `~/.codex/config.toml`，key 只写入 0600 配置
- 不包含或再分发 OpenAI 应用二进制

# Changelog

## 1.0.7 — 2026-10-23

- macOS 应用内置 Node 24 运行时，不再依赖系统安装 Node。
- 启动器优先使用应用内 node，缺失时才回退系统 Node。
- 修复“缺少 node 组件，无法使用改装版”的问题。

## 1.0.6 — 2026-10-23

- macOS 应用图标改为 ChatGPT 原生图形黑板化版本（黑底白线）。
- 应用包与发布资产同步更新。

## 1.0.5 — 2026-10-23

- 新增独立 macOS 应用包 Codex for Free.app，bundle id 独立，可与官方 Codex 并存。
- 应用内置启动器：自动定位 Node、启动隔离面板、打开浏览器。
- 保持隔离配置 ~/.codex-for-free，不改官方 ~/.codex。
- 新增构建脚本 scripts/build-app.sh。

## 1.0.4 — 2026-10-23

- 与官方 Codex 并存：Codex for Free 默认使用独立目录 ~/.codex-for-free，不再改写官方 ~/.codex 配置。
- 新增 cfm restore-official：一键移除旧版本写入官方 config.toml 的 model/provider/catalog 修改。
- cfm codex 通过 CODEX_HOME 使用隔离配置；官方 app 保持官方账号与模型。
- library export 默认读取隔离库，--official 只读导入官方对话；索引合并，不覆盖。
- doctor 同时显示 Free/Official 两个 home，并提示官方配置是否仍含 CFM 修改。

## 1.0.3 — 2026-10-23

- About 页新增「检查更新」与自动更新功能（cfm check / cfm update）。
- About 页新增小字：中国大陆用户完整服务必须使用魔法。
- 服务端新增 /api/update 与 /api/update/run。

## 1.0.2 — 2026-10-23

- 品牌统一为 Codex for Free；包名、仓库地址、UI、About 页全部更新。
- UI 统一为 ChatGPT 风格：中性深色、绿色强调、扁平卡片、胶囊按钮、统一弹窗。
- 修复项目列表计数错位与副标题重复显示 Codex 的问题。
- 新增 cff 命令别名（与 cfm 等价）。
- 内部数据目录 ~/.codex-for-mac 保留，兼容已有配置与密钥。

## 1.0.1 — 2026-10-23

- 新增首次启动「先把模型接上」向导：选择供应商、粘贴 API key、测试 /models 与 /responses、保存并切换默认模型。
- 安全：key 长度/字符校验、仅允许 https（本机 localhost 可用 http）、拒绝带凭据的 URL、POST Origin 校验、限流、安全响应头。
- 修复 providers/test 的 Authorization 头拼接错误。
- 面板「模型供应商」增加「接入新模型」入口。

## 1.0.0 — 2026-10-23

首个正式版：从“能用的工具”升级为“给不想用终端的人的 Codex 图形前端”。

### 新增

- 全新「关于」页（/about）与面板内 About 弹窗：William 头像、Powered by William、版本、发布日期、GitHub 链接。
- 面板头部增加 William 头像入口；副标题显示 Powered by William。
- 新手欢迎卡：三步引导（导出对话 → 接入模型 → 开始归档）。
- 双击启动脚本 start.command。
- README 重写为小白安装路径；明确 v1 的产品定位。

### 保持

- 本地对话 Markdown + JSON 结构化保存、按项目归档。
- 模型供应商注册/切换/Responses 探活；DeepSeek 实测可用。
- 官方 Codex 框架、skills、plugins、marketplaces 只读保留。
- 存储体检、VACUUM、旧会话归档。

## 0.1.1 — 2026-10-23

- 运行时要求明确为 Node.js >= 24（使用内置 `node:sqlite`）。
- 文档补充与 Noesis 的关系：不内嵌引擎，导出普通 Markdown/JSON，可直接作为 Noesis/Obsidian 知识库。
- 发布资产与主分支对齐。

## 0.1.0 — 2026-10-23

首个公开版本。

### 新增

- `cfm library export`：把 Codex 对话按项目导出为 Markdown + 结构化 JSON，生成 `index.json`、`project.json`。
- `cfm ui`：本地 127.0.0.1 面板，浏览项目/对话、预览 Markdown、在 Finder 显示、导出、供应商管理与存储维护。
- `cfm storage report|vacuum|archive`：存储体检、SQLite VACUUM、旧会话归档（只移不删 + manifest）。
- `cfm providers`：DeepSeek / Qwen / Kimi / GLM / MiniMax / OpenAI-compatible 预设，注册、切换、Responses API 探活。
- `cfm skills`：只读列出官方 skills / plugins / marketplaces。
- `cfm doctor`：环境、存储、扩展、供应商与风险项体检。
- 受控 TOML 合并：只改 `# >>> cfm:` 标记块与根级键，保留官方配置。

### 验证

- 12 条真实 Codex 会话导出成功，3 个项目分组，Markdown/JSON 可读。
- DeepSeek `/models` 与 `/responses` 均返回 200，模型目录只含 DeepSeek 条目。
- 路径穿越请求被拒绝；单元测试 8/8 通过。
