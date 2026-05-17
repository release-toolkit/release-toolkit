# 预设格式化器详解 (@release-toolkit/changelog-presets)

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

| 格式化器 | 类型 | 功能 |
|----------|------|------|
| `emoji-prefix` | LineFormatter | 根据 commit type 添加 emoji 前缀 |
| `category-group` | LogFormatter | 按类型分组（Features、Bug Fixes 等） |
| `markdown-bold` | LineFormatter | Markdown 粗体格式化 |

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

- `@release-toolkit/core` — 类型定义（`ILineFormatter`, `ILogFormatter`）
