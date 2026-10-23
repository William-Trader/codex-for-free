# Security

## Reporting

请通过 GitHub Security Advisory 或私下联系维护者，不要在公开 issue 中贴 API key、cookie、日志中的个人信息。

## 设计约束

- 仓库不包含任何凭据、用户数据或本机路径。
- API key 仅存放于 `~/.codex-for-mac/secrets/<id>.key`（目录 0700，文件 0600）。
- 写入 `~/.codex/config.toml` 的 key 位于 0600 文件的 `http_headers` 中；本工具不会回显 key。
- Web 面板仅绑定 `127.0.0.1`；不提供远程访问、CORS 或上传接口。
- 所有文件路径参数都校验是否位于本地库根目录内，拒绝 `..` 穿越。
- 归档只移动不删除，跨卷时复制并保留原件。

## 已知边界

- 本工具会读取 `~/.codex` 下的会话数据库与 rollout 文件，这是它的功能前提。
- 导出到本地库的内容会做常见密钥模式脱敏，但无法保证覆盖所有自定义格式；分享前请自行复核。
