# @release-toolkit/core

核心库，提供版本检测、Changelog 生成、插件系统的底层能力。

## 功能模块

| 模块 | 说明 |
|------|------|
| **Git** | `GitReader` - 读取 git commit 历史 |
| **Version** | `PackageScanner` - 检测包版本变化 |
| **Changelog** | `ChangelogCollector` / `ChangelogRenderer` - 生成 changelog |
| **Plugin** | `PluginManager` / `Pipeline` - 插件管理 & 执行管道 |
| **Output** | `PRCommentPoster` / `FileOutputter` - 输出到文件或 PR 评论 |
| **CI** | `CiRunner` - CI 环境执行入口 |

## 安装

```bash
npm install @release-toolkit/core
```

## 使用示例

```typescript
import { CiRunner } from '@release-toolkit/core';

const runner = new CiRunner({
  baseRef: 'origin/main',
  plugins: ['@release-toolkit/changelog-presets'],
  repoUrl: 'https://github.com/org/repo',
});

const result = await runner.run();
console.log(result.changelog);
```

## 导出常量

- `COMMIT_TYPE_EMOJI` - commit 类型对应的 emoji
- `COMMIT_TYPE_CATEGORY` - commit 类型到分类的映射
- `DEFAULT_PLUGINS` - 默认插件列表
