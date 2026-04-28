# tag

Tag 管理 — 为版本变更的包创建并推送 git tag。

## TagManager

扫描 `VersionDiffResult[]`，为有版本变更的包创建 `{packageName}@{version}` 格式的 tag，最后批量 push。

## 使用

```ts
import { TagManager } from './index.js';

const manager = new TagManager({ cwd: process.cwd(), dryRun: false });
const results = await manager.createAndPushTagsForDiffs(versionDiffs);
// results: [{ packageName, version, tagName, created, pushed }]
```

## Tag 命名格式

```
@scope/package-name@1.2.3
package-name@1.2.3
```
