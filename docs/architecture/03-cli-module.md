# CLI 模块详解 (@release-toolkit/cli)

## 模块结构

```
packages/cli/src/
├── commands/
│   ├── collect.ts    # prLogCollector 命令
│   ├── preview.ts    # releasePreview 命令
│   └── publish.ts    # releasePublisher 命令
└── index.ts          # CLI 入口
```

## 入口文件

```typescript
// packages/cli/src/index.ts
import { program } from 'commander';
import { collectCommand } from './commands/collect';
import { previewCommand } from './commands/preview';
import { publishCommand } from './commands/publish';

program
  .name('release')
  .description('release-toolkit: prLogCollector → releasePreview → releasePublisher')
  .version('1.0.0');

program.addCommand(collectCommand);
program.addCommand(previewCommand);
program.addCommand(publishCommand);

program.parse();
```

## 命令列表

| 命令 | 功能 | 对应 core 模块 |
|------|------|----------------|
| `release collect` | PR 日志收集 | `pr-log-collector` |
| `release preview` | 版本发布预览 | `release-preview` |
| `release publish` | 发布版本 | `release-publisher` |

## 使用示例

```bash
# PR 日志收集（写入 PR 描述体）
npx release collect --pr-number 123 --owner my-org --repo my-repo

# 版本发布预览（评论到 PR）
npx release preview --pr-number 123 --owner my-org --repo my-repo

# 发布版本（一般由 release-publish.yml 在合并后触发）
npx release publish
```

> 目标分支由 `.release-toolkit/config.json` 的 `branches.base` 控制，
> `release preview` / `release publish` 支持 `--branch` 覆盖 flag。

## 依赖

- `@release-toolkit/core` — 核心功能
- `commander` — 命令行解析
