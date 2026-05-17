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
# PR 日志收集
npx release collect --pr=123 --branch=dev

# 版本发布预览
npx release preview --branch=main

# 发布版本
npx release publish --branch=main
```

## 依赖

- `@release-toolkit/core` — 核心功能
- `commander` — 命令行解析
