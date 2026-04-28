# @release-toolkit/changelog-presets

内置格式化插件集，提供 changelog 样式增强功能。

## 插件

### `emojiPrefix`

为 commit 类型添加 emoji 前缀。

```
feat: 新功能  →  ✨ feat: 新功能
fix: 修复     →  🐛 fix: 修复
```

### `categoryGroup`

按标准分类分组排序。

| 类型 | 分类 |
|------|------|
| feat | Features |
| fix | Bug Fixes |
| perf | Performance |
| refactor | Refactoring |
| docs | Documentation |
| test | Tests |
| build/ci | Build & CI |
| chore/style | Chores |
| revert | Reverts |

### `markdownBold`

将 scope 部分加粗显示。

```
feat(core): 优化 → ✨ feat(**core**): 优化
```

## 安装

```bash
npm install @release-toolkit/changelog-presets
```

## 使用

```typescript
import { emojiPrefix, categoryGroup, markdownBold } from '@release-toolkit/changelog-presets';

const renderer = new ChangelogRenderer({
  plugins: [emojiPrefix, markdownBold, categoryGroup],
});
```

## 导出常量

从 `@release-toolkit/changelog-presets` 也可以导入格式化常量：

```typescript
import { COMMIT_TYPE_EMOJI, COMMIT_TYPE_CATEGORY } from '@release-toolkit/changelog-presets';
```

| 常量 | 说明 |
|------|------|
| `COMMIT_TYPE_EMOJI` | commit 类型到 emoji 的映射 |
| `COMMIT_TYPE_CATEGORY` | commit 类型到分类的映射 |

## 顺序

插件按 `priority` 执行：`emojiPrefix(10) → markdownBold(15) → categoryGroup(10)`

> 依赖：`@release-toolkit/core` (peerDependency)
