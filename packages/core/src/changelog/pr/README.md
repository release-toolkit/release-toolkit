# changelog/pr

PR 级别的 Changelog 处理 — 获取 PR 数据、渲染快照、保存和消费变更记录。

## 模块

| 文件 | 主要导出 | 说明 |
|------|---------|------|
| `types.ts` | `PRChangelogData`, `PRMeta`, `CommitTitle` | PR changelog 数据类型 |
| `comment-parser.ts` | `extractReleaseLog`, `extractDeclaredPackages` | 解析 PR 评论中的标记 |
| `fetcher/` | `fetchPRData` | 从 GitHub API 获取 PR 数据 |
| `renderer.ts` | `renderPRChangelogMD` | 渲染为 Changeset 风格 Markdown |
| `storage.ts` | `savePRChangelog`, `listPRChangeLogs` | 保存/列出 PR 变更快照 |
| `snapshot-consumer.ts` | `consumeAllSnapshots`, `collectEntriesFromSnapshots` | 消费快照提取结构化 ChangeLogEntry[] |

## 评论标记

PR 评论中可使用以下 HTML 注释标记：

```html
<!-- PACKAGES: @pkg/a, @pkg/b -->        显式声明影响的包
<!-- RELEASE-LOG-START -->...<!-- RELEASE-LOG-END -->  嵌入发布日志
```

## 使用

```ts
import { fetchPRData, savePRChangelog, consumeAllSnapshots } from './index.js';

// Stage 1: 获取 + 保存
const data = await fetchPRData({ owner, repo, token, prNumber: 123 });
savePRChangelog(cwd, data, { overwrite: 'skip' });

// Stage 3: 消费
const snapshots = consumeAllSnapshots(cwd);
```
