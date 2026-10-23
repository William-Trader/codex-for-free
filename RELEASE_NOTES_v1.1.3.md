## Codex for Free v1.1.3 — 实际使用修复

这一版修的是装好之后真正会撞上的问题，不是新功能。

### 修复

- **`cfm` 之前根本没装到 PATH**：所有 CLI 功能只能靠 `node bin/cfm.mjs` 使用。新增 `cfm install-cli`，安装器也会自动把 `cfm` / `cff` 链接到 `/usr/local/bin` 或 `~/.local/bin`，必要时写入 `~/.zshrc` 的 PATH。
- **`cfm doctor` 报 `Codex CLI not found`**：检测逻辑只认 `/Applications/ChatGPT.app`，改名后的前端找不到内置 CLI，导致 `cfm codex` 和面板 `/api/chat` 一起失效。现在会扫描 `/Applications` 和 `~/Applications` 下所有 app。
- **CLI 指向废弃目录**：`CODEX_HOME` 之前固定为 `~/.codex-for-free`，而前端实际读写 `~/.codex`。结果 `cfm storage report`、`cfm library export`、`cfm providers use` 全部作用在死目录上，切换 provider 对 app 无效。现在按实际会话数据自动选择。
- **知识库不自动更新**：`cfm search` 之前只搜旧索引，新对话搜不到。现在检测到索引落后会先自动同步。
- **自动同步会把归档项目复活**：`_archive/manifest.csv` 里的项目现在会被跳过，索引同时清理已不存在的目录条目。
- **官方 app 被删后无法 repair**：安装器与 `cfm repair` 现在可以用已安装的前端自身作为重建源。
- `providers test --json` 不再混入文本输出。

### 打包

安装包现在同时包含安装器和 CLI 层（`bin/` + `src/`），装完即可用 `cfm`。
