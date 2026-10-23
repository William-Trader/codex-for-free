# Codex for Mac v1.0.1 — 小白 API 接入 + 安全加固

v1.0 的首个补丁，重点是把“第一次接模型”做成真正的小白流程。

## 新增

- **首次启动向导**：选择供应商 → 粘贴 API key → 测试 /models 与 /responses → 保存并切换默认模型。
- 模型供应商页新增「接入新模型」入口。
- 支持 DeepSeek（实测）、Qwen、Kimi、GLM、MiniMax、自定义 OpenAI-compatible 端点。
- 未配置时自动弹出向导；可点「稍后」跳过。

## 安全

- API key 只写入本机 0600 文件，面板不回显、不记录。
- key 长度与字符校验；拒绝包含空白/控制字符的 key。
- Base URL 只允许 https；本机 localhost 才允许 http；拒绝带用户名密码的 URL。
- POST 请求校验 Origin；30 次/分钟限流；安全响应头（nosniff / DENY / no-referrer）。
- 每次接入先探测 /responses，不支持 Responses API 的端点不会保存。

## 修复

- 修复 providers/test 的 Authorization 头拼接错误。
- 修复静态头像资源未服务导致 About 页破图。

## 安装

    npm i -g codex-for-mac-1.0.1.tgz
    cfm ui

或双击仓库里的 start.command。

要求：macOS + Node.js 24，已安装 Codex 应用/CLI。

## 验证

- 单元测试 10/10 通过。
- 真实 DeepSeek key：/api/onboarding/test 与 apply 均成功；/models 200、/responses 200。
- 跨域 Origin 请求返回 403。
- 临时目录中 config.toml、secret、catalog 权限均为 0600。
- 发布资产 SHA256 与 GitHub digest 一致。
