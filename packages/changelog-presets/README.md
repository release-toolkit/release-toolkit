# @release-toolkit/changelog-presets

Changelog 格式化预设，提供常见的日志格式化器。

## 提供的格式化器

| 格式化器 | 说明 |
|----------|------|
| `category-group` | 按分类分组（feat/fix/docs 等） |
| `emoji-prefix` | 添加 emoji 前缀 |
| `markdown-bold` | Markdown 加粗格式 |

## 使用

通过 `@release-toolkit/core` 的插件系统自动加载，无需手动配置。

```typescript
// 在 .release-toolkit/config.json 中配置
{
  "plugins": ["emoji-prefix", "category-group", "markdown-bold"]
}
```

## 默认启用

默认配置已启用全部三个格式化器，无需额外配置。

详见 [架构文档](https://github.com/release-toolkit/release-toolkit/tree/dev/docs/architecture)
