# CLI 模块详解 (@release-toolkit/cli)

> 本文主体描述当前三个命令。目标 CLI 是 GitHub Actions 的稳定执行接口，命令契约见 [实施规格第 6 节](../implementation/README.md#6-cli-与-workflow-契约)。

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

| 命令              | 功能         | 对应 core 模块      |
| ----------------- | ------------ | ------------------- |
| `release collect` | PR 日志收集  | `pr-log-collector`  |
| `release preview` | 版本发布预览 | `release-preview`   |
| `release publish` | 发布版本     | `release-publisher` |

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
> 目前 CLI 暂未提供 `--branch` 覆盖 flag。

## 依赖

- `@release-toolkit/core` — 核心功能
- `commander` — 命令行解析

## 目标命令

| 命令                      | 责任                                    | 外部写入                     |
| ------------------------- | --------------------------------------- | ---------------------------- |
| `release change collect`  | 收集 Feature PR 日志并生成 Entry        | 可选，必须支持 dry-run       |
| `release change validate` | 校验 Entry/no-release                   | 无                           |
| `release plan prepare`    | 创建 Draft Plan 所需文件                | 可选，必须支持 dry-run       |
| `release plan refresh`    | 合并 pending Entry、selection、override | 可选，必须校验 revision      |
| `release plan lock`       | 生成不可变 plan snapshot                | 写 release branch            |
| `release publish`         | 执行 Locked Plan                        | Tag、Release、Registry/hooks |

所有命令必须支持 `--cwd`、`--config-path`、`--json`；改变状态的命令必须支持 `--dry-run`。JSON 输出是 Actions 间的数据契约，不能从人类可读日志反向解析。
