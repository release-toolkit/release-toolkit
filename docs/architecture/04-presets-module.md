# 预设格式化器详解 (@release-toolkit/changelog-presets)

> 本文主体描述当前 formatter。目标插件拆分为 EntryFormatter 与 ReleaseFormatter，详见 [实施规格 FR-17](../implementation/README.md#fr-17-插件)。

## 模块结构

```
packages/changelog-presets/src/
├── formatters/
│   ├── emoji-prefix.ts      # Emoji 前缀格式化器
│   ├── category-group.ts    # 分类分组格式化器
│   └── markdown-bold.ts     # Markdown 粗体格式化器
├── constants.ts             # 常量定义
└── index.ts                 # 统一导出
```

## 格式化器列表

| 格式化器         | 类型          | 功能                                 |
| ---------------- | ------------- | ------------------------------------ |
| `emoji-prefix`   | LineFormatter | 根据 commit type 添加 emoji 前缀     |
| `category-group` | LogFormatter  | 按类型分组（Features、Bug Fixes 等） |
| `markdown-bold`  | LineFormatter | Markdown 粗体格式化                  |

## Emoji 映射

```typescript
// constants.ts
export const COMMIT_TYPE_EMOJI: Record<string, string> = {
  feat: '✨',
  fix: '🐛',
  docs: '📝',
  style: '💄',
  refactor: '♻️',
  perf: '⚡️',
  test: '✅',
  build: '📦️',
  ci: '👷',
  chore: '🔧',
  revert: '⏪️',
};
```

## 分类映射

```typescript
// constants.ts
export const COMMIT_TYPE_CATEGORY: Record<string, { name: string; emoji: string }> = {
  feat: { name: 'Features', emoji: '✨' },
  fix: { name: 'Bug Fixes', emoji: '🐛' },
  perf: { name: 'Performance', emoji: '⚡️' },
  style: { name: 'Styles', emoji: '💄' },
  docs: { name: 'Documentation', emoji: '📝' },
  test: { name: 'Tests', emoji: '✅' },
  build: { name: 'Build', emoji: '📦️' },
  ci: { name: 'CI', emoji: '👷' },
  chore: { name: 'Misc', emoji: '🔧' },
  refactor: { name: 'Refactor', emoji: '♻️' },
  revert: { name: 'Reverts', emoji: '⏪️' },
};
```

## 依赖

- `@release-toolkit/types` — formatter 和 changelog 类型
- `@release-toolkit/markdown` — Markdown 纯函数和常量

## 目标改造

- 类型依赖统一改为 `@release-toolkit/types`，避免 presets 依赖 Core 实现。
- `emoji-prefix`、`markdown-bold` 迁移为 EntryFormatter。
- `category-group` 迁移为 ReleaseFormatter，输入整个 Release Plan 的 selected/public Entry。
- formatter 只返回格式化结果，不修改原始 Entry、package selection、targetVersion 或 plan status。
- formatter 顺序必须确定且可测试：override → EntryFormatter → ReleaseFormatter。
- 旧 `formatLine` / `format` 通过 adapter 兼容，并输出明确弃用信息。

验收测试至少覆盖插件顺序、异常隔离、public/internal/hidden 过滤、重复日志和空日志。
