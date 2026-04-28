# config

配置管理 — 加载、合并、初始化 `.releasetoolkit/config.json`。

## 主要导出

| 导出 | 说明 |
|------|------|
| `loadConfig` | 加载 CI 配置（三级合并：默认值 ← 配置文件 ← 显式参数） |
| `loadPRChangelogConfig` | 加载 PR changelog 专用配置 |
| `initConfig` | 初始化配置文件模板 |
| `CONFIG_DIR` | 配置目录名 `.releasetoolkit` |
| `CONFIG_FILE` | 配置文件名 `config.json` |

## 配置结构

```json
{
  "devBranch": "dev",
  "baseRef": "main",
  "changelogDir": ".changelog",
  "outputPath": "CHANGELOG.md",
  "commentPr": true,
  "dryRun": false,
  "plugins": ["emoji-prefix", "category-group", "markdown-bold"],
  "fileWriteMode": "overwrite",
  "createTags": true,
  "createRelease": true,
  "afterRelease": [],
  "prChangelog": {
    "packagesDir": "packages",
    "rootTag": "root",
    "packageMap": {}
  }
}
```

## 使用

```ts
import { loadConfig, initConfig } from './index.js';

// 初始化
initConfig(process.cwd());

// 加载（三级合并）
const config = loadConfig(cwd, { dryRun: true });
```
