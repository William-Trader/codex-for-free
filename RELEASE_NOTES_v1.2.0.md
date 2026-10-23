## Codex for Free v1.2.0 — DeepSeek 能力对齐

这一版把「配了 DeepSeek」变成「DeepSeek 的能力被正确声明和使用」，并附上真实任务测评。

### 修复

- **模型目录与供应商不符**：上下文按 1,048,576 声明（原 131,072，少 8 倍），最大输出 393,216，输入模态按 API 返回（flash 支持图片）。
- **reasoning 档位错误**：DeepSeek 只支持 `low / high / max`，原来写的是 `low / medium / high` 且默认 `medium` —— 一个 API 不认的档位。现在按 `/models` 的 `effort` 字段生成，默认跟随供应商的 `high`。
- **写坏配置**：`cfm providers use` 会同时留下 `cfm:defaults` 和 `cfm:login-bypass` 两组根键，并重复声明 `[model_providers.deepseek]`，生成的 `config.toml` 不是合法 TOML。现已去重，并加回归测试。
- **工具输出截断过狠**：在 1M 上下文下仍按 10k tokens 截断，改为按窗口自适应（最高 60k）。
- **`cfm codex --help` 被 cfm 自己吞掉**：现在 `cfm codex ...` 全量透传给 Codex CLI。
- **effort 无校验**：`cfm providers use --effort` 现在拒绝供应商不支持的档位，并给出可选值。

### 新增

- `cfm providers sync [id]`：从 `/models` 拉取真实上下文、输出上限、reasoning 档位、输入模态。

### 测评

README 新增「DeepSeek 在 Codex 里的实际表现」：10 项真实任务（问答、读文件、改文件、多步执行、缺失文件、长上下文、多文件重构、并发）、耗时与结果，以及 low/high/max 的 token 与耗时对比。

结论：日常读改写跑任务可靠，effort 确实生效（max 的思考 token 约为 low 的 25 倍），但简单题上不改变答案。

### 测试

`node --test` → 15 pass / 0 fail。
