# commands

CLI 命令定义 — 基于 `commander` 注册各子命令。

## 命令列表

| 命令 | 文件 | 说明 |
|------|------|------|
| `release ci` | `ci.command.ts` | Stage 3：完整 CI 流水线 |
| `release preview` | `preview.command.ts` | Stage 2：消费快照 + 发预览评论 |
| `release init` | `init.command.ts` | 初始化 `.releasetoolkit/config.json` |
| `release pr-changelog` | `pr-changelog.command.ts` | PR 级 changelog：fetch/list 子命令 |

## 使用示例

```bash
# 初始化配置
release init

# Stage 1: 保存 PR 变更快照
release pr-changelog fetch --pr-number 123 --save

# Stage 2: 预览
release preview --dry-run

# Stage 3: 完整发布
release ci --base main --dry-run
```
