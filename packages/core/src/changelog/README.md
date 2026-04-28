# changelog

Changelog 模块 — 管理 release 级别和 PR 级别的变更日志。

## 结构

- `release/` — Release 级别：读取、合并、渲染正式 CHANGELOG
- `pr/` — PR 级别：获取 PR 数据、渲染快照、保存/消费 PR 变更记录

## 三阶段工作流

| 阶段 | 触发条件 | 使用子模块 | 说明 |
|------|---------|-----------|------|
| Stage 1 | PR → dev 分支 | `pr/` | 保存 PR 变更快照 |
| Stage 2 | PR → base 分支 | `pr/` + `release/` | 消费快照，发预览评论 |
| Stage 3 | 合并到 base | `release/` + `pr/` | 正式发布 CHANGELOG |

## 主要导出

```ts
import {
  // Release 级别
  ChangelogCollector, ChangelogRenderer, ChangelogFileReader,
  saveReleaseSummary, listReleaseSummaries,
  // PR 级别
  fetchPRData, renderPRChangelogMD, savePRChangelog, listPRChangeLogs,
  consumeAllSnapshots, collectEntriesFromSnapshots,
  extractReleaseLog, extractDeclaredPackages,
} from './index.js';
```
