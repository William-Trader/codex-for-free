# Codex for Free v1.0.7 — 内置 Node，双击即用

## 修复

- 修复“缺少 node 组件，无法使用改装版”的问题。
- macOS 应用包内置 Node.js 24.18.0（arm64），不再依赖系统安装 Node。
- 启动器优先使用应用内 `Resources/node/bin/node`；只有内置缺失时才回退系统 Node。

## 验证

- 安装路径：`/Applications/Codex for Free.app`
- 启动后进程使用应用内置 Node：
  `/Applications/Codex for Free.app/Contents/Resources/node/bin/node`
- 面板 `http://127.0.0.1:4317/api/summary` 返回 200
- 应用包约 37 MB（Node 运行时已压缩）
- 仍使用隔离配置 `~/.codex-for-free`，官方 Codex 不受影响

## 安装

1. 下载 `Codex-for-Free-1.0.7-macOS.zip`
2. 解压后拖进 Applications
3. 双击启动

无需再单独安装 Node.js。
