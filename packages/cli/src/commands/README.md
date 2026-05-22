# cli/src/commands

`@release-toolkit/cli` 的子命令实现，每个文件对应一个 `commander` 命令。

| 命令 | 文件 | 调用 | 说明 |
|------|------|------|------|
| `release collect` | `collect.ts` | `collectPRLog` | 在 PR 描述体写入结构化变更日志 |
| `release preview` | `preview.ts` | `previewRelease` | 检测版本变更 + 聚合日志并发评论 |
| `release publish` | `publish.ts` | `publishRelease` | 创建 Tag / GitHub Release + 执行钩子 |

## 通用参数

| 参数 | 默认 | 说明 |
|------|------|------|
| `--pr-number <number>` | 必填（collect/preview） | PR 编号 |
| `--owner <owner>` | 必填（collect/preview） | 仓库所有者 |
| `--repo <repo>` | 必填（collect/preview） | 仓库名称 |
| `--token <token>` | `process.env.GITHUB_TOKEN` | GitHub Token |
| `--cwd <path>` | `process.cwd()` | 工作目录 |
| `--config-path <path>` | `.release-toolkit/config.json` | 配置文件（相对 `--cwd` 或绝对路径） |

`collect` 额外支持 `--save / --no-save` 控制是否保存快照到 `.release-toolkit/releases/`。

## 使用示例

```bash
# 收集日志（写入 PR 描述体）
release collect --pr-number 123 --owner my-org --repo my-repo

# 预览版本变更（评论到 PR）
release preview --pr-number 123 --owner my-org --repo my-repo

# 发布（合并到目标分支后由 CI 调用）
release publish
```
