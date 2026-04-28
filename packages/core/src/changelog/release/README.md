# changelog/release

Release 级别的 Changelog 处理 — 合并、渲染正式发布日志。

## 模块

| 文件 | 类/函数 | 说明 |
|------|--------|------|
| `collector.ts` | `ChangelogCollector` | 合并多条目数组，按 hash+type+scope+subject 去重 |
| `renderer.ts` | `ChangelogRenderer` | 渲染为基础 Markdown（版本标题 + 平铺列表） |
| `history.ts` | `saveReleaseSummary` / `listReleaseSummaries` | 保存/列出 release 摘要文件 |

## 使用

```ts
import { ChangelogCollector, ChangelogRenderer } from './index.js';

// 从 PR 快照收集条目
import { consumeAllSnapshots, collectEntriesFromSnapshots } from '../pr/index.js';

const snapshots = consumeAllSnapshots(process.cwd());
const entries = collectEntriesFromSnapshots(snapshots);

// 合并
const collector = new ChangelogCollector();
const merged = collector.collect([entries]);

// 渲染（通常通过 Pipeline + 插件完成）
const renderer = new ChangelogRenderer({ repoUrl: 'https://github.com/owner/repo' });
const output = {
  version: '1.0.0',
  date: new Date().toISOString().split('T')[0],
  entries: merged,
};
const md = renderer.renderMarkdown(output);
```
