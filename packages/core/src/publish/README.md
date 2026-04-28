# publish

发布模块 — 创建 GitHub Release 并执行 afterRelease 钩子。

## GithubReleaseCreator

根据 tag 列表批量创建 GitHub Release，支持 dry-run、draft、prerelease 模式。

## afterRelease 钩子

Release 创建后执行自定义脚本，注入以下环境变量：

| 环境变量 | 说明 |
|---------|------|
| `RELEASE_ID` | Release ID |
| `RELEASE_UPLOAD_URL` | 资源上传 URL |
| `RELEASE_TAG_NAME` | Tag 名称 |
| `RELEASE_HTML_URL` | Release 页面 URL |
| `PACKAGE_NAME` | 包名 |
| `PACKAGE_VERSION` | 版本号 |

## 使用

```ts
import { GithubReleaseCreator } from './index.js';

const creator = new GithubReleaseCreator({
  dryRun: false,
  prerelease: true,
  afterRelease: ['node scripts/notify.js'],
});

const results = await creator.createReleases(['@pkg/core@1.0.0'], changelogMd);
```
