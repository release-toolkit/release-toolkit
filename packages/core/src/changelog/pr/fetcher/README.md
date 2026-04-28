# changelog/pr/fetcher

从 GitHub API 获取 PR 数据并构建 `PRChangelogData`。

## 模块

| 文件 | 主要导出 | 说明 |
|------|---------|------|
| `index.ts` | `fetchPRData` | 入口：并行拉取 PR 详情/commits/评论/文件，组装数据 |
| `github-api.ts` | `getPR`, `getCommits`, `getFirstReviewComment`, `getAllFiles` | GitHub API 封装（支持分页） |
| `package-resolver.ts` | `resolvePackages` | 解析 PR 影响的包名（优先级：评论声明 > diff 推断 > 回退） |

## 包名解析优先级

1. **评论显式声明**：`<!-- PACKAGES: @pkg/a, @pkg/b -->`
2. **Diff 推断**：根据文件路径映射包目录
3. **回退**：从 commit 消息和 PR 标签提取

## 配置

在 `.releasetoolkit/config.json` 中配置：

```json
{
  "prChangelog": {
    "packagesDir": "packages",
    "rootTag": "root",
    "packageMap": { "core": "@myorg/core" }
  }
}
```

## 使用

```ts
import { fetchPRData } from './index.js';

const data = await fetchPRData({
  owner: 'myorg',
  repo: 'myrepo',
  token: process.env.GITHUB_TOKEN!,
  prNumber: 42,
});
```
