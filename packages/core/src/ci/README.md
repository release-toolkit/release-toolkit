# ci

CI Runner — 编排完整的发布流水线（Stage 3）。

## CiRunner

合并后执行，按步骤完成：版本检测 → changelog 生成 → 写入文件 → 创建 tag → GitHub Release → PR 评论 → 保存摘要。

## 使用

```ts
import { CiRunner } from './ci-runner.js';

const runner = new CiRunner({ baseRef: 'main', dryRun: true });
const result = await runner.run();
// result: { success, changed, versionDiffs, entryCount, markdown, dryRun }
```

## 流水线步骤

| 步骤 | 说明 |
|------|------|
| Step 0 | 检测 GitHub Actions 环境 |
| Step 1 | 检测版本变更（`PackageScanner`） |
| Step 2 | 消费 PR changelog 快照 |
| Step 3 | 构建统一 Release Changelog |
| Step 4 | 写入各包 CHANGELOG.md |
| Step 5 | 创建 git tags |
| Step 6 | 创建 GitHub Releases |
| Step 7 | 更新 PR 评论 |
| Step 8 | 保存 release 摘要 |
