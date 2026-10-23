# 本地对话库格式

## 目录

```
<root>/
├── index.json
├── _README.md
├── projects/<slug>/project.json
├── projects/<slug>/conversations/<date>-<slug>-<id8>.md
├── projects/<slug>/conversations/<date>-<slug>-<id8>.json
└── inbox/<date>-<slug>-<id8>.{md,json}
```

<root> 默认 `~/Documents/Codex Library`，可用 `CFM_LIBRARY` 或 `cfm library set <dir>` 修改。

## project.json

```json
{
  "schema": "codex-for-mac/project@1",
  "id": "project-id-or-null",
  "name": "demo",
  "path": "/Users/me/work/demo",
  "slug": "demo-1a2b3c",
  "dir": "projects/demo-1a2b3c",
  "missing": false,
  "createdAt": "2026-10-23T07:00:00.000Z",
  "conversations": 12
}
```

## conversation.json

```json
{
  "schema": "codex-for-mac/conversation@1",
  "id": "01a1678a-...",
  "title": "重构导出模块",
  "createdAt": "2026-10-23T06:54:46.000Z",
  "model": "deepseek-v4-pro",
  "provider": "deepseek",
  "reasoningEffort": "high",
  "cwd": "/Users/me/work/demo",
  "project": { "slug": "demo-1a2b3c", "name": "demo", "path": "/Users/me/work/demo" },
  "tokensUsed": 12345,
  "archived": false,
  "source": { "rollout": "/Users/me/.codex/sessions/..." },
  "messages": [
    { "role": "user", "text": "...", "at": "2026-10-23T06:54:46.000Z" },
    { "role": "assistant", "text": "...", "at": "2026-10-23T06:54:47.000Z" }
  ]
}
```

## index.json

```json
{
  "schema": "codex-for-mac/library@1",
  "generatedAt": "...",
  "root": "...",
  "projects": [ ...project.json... ],
  "conversations": [
    {
      "id": "...",
      "title": "...",
      "projectSlug": "demo-1a2b3c",
      "createdAt": "...",
      "model": "...",
      "provider": "...",
      "files": { "markdown": "projects/.../x.md", "json": "projects/.../x.json" }
    }
  ]
}
```

## 兼容性

纯文件格式，无数据库依赖。可直接被 Obsidian、VS Code、Spotlight、任何静态站点或知识库工具读取。删除后重跑 `cfm library export` 即可重建。
