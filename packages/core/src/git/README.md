# git

Git 操作封装 — 基于 `simple-git` 提供常用的 git 读取和 tag 操作。

## GitReader

| 方法 | 说明 |
|------|------|
| `diffFiles(baseRef, headRef?, pattern?)` | 获取两个 ref 间变更的文件列表 |
| `showFileContent(ref, filePath)` | 获取指定 ref 下的文件内容 |
| `getCurrentSha()` | 获取当前 HEAD SHA |
| `tag(tagName, message?)` | 创建 tag（带消息用 annotated tag） |
| `pushTags(remote?)` | 推送所有本地 tag 到远程 |
| `getRemoteUrl(remote?)` | 获取远程仓库 URL |

## 使用

```ts
import { GitReader } from './git-reader.js';

const git = new GitReader(process.cwd());
const files = await git.diffFiles('main', 'HEAD', ['package.json']);
const sha = await git.getCurrentSha();
await git.tag('@pkg/core@1.0.0', 'Release @pkg/core@1.0.0');
await git.pushTags();
```
