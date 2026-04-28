# output

输出层 — GitHub 环境检测、PR 评论、文件写入。

## 模块

| 文件 | 类 | 说明 |
|------|---|------|
| `github-context-detector.ts` | `GithubContextDetector` | 检测 GitHub Actions 环境，解析 PR/仓库/Token 信息 |
| `pr-comment-poster.ts` | `PRCommentPoster` | 创建/更新 PR 评论（基于锚点实现幂等更新） |
| `file-outputter.ts` | `FileOutputter` | 写入文件（支持 append/overwrite 模式） |

## 使用

```ts
import { GithubContextDetector, PRCommentPoster, FileOutputter } from './index.js';

// 检测环境
const ctx = new GithubContextDetector().detect();

// 发评论
const poster = new PRCommentPoster('owner', 'repo', 'token');
await poster.postComment(42, '## Release Preview\n...');

// 写文件
const outputter = new FileOutputter();
outputter.write({ filePath: 'CHANGELOG.md', content: md, mode: 'overwrite' });
```
