## Codex for Free v1.1.2 — 完整性与稳定性收尾

- 全量检查 GPT 前端、provider、聊天、工具调用、面板、知识库
- `providers test --json` 只输出 JSON，不再混入文本
- 安装器配置生成测试：key 正确写入、占位符不再存在、配置 600
- 新增 `docs/VERIFICATION.md`：功能矩阵与已知边界
- 知识库保持精简：1 个活动项目 / 1 个对话，测试对话在 `_archive`

安装器仍不包含 OpenAI 应用二进制。
