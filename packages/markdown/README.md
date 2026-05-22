# @release-toolkit/markdown

release-toolkit 各包共用的 **纯字符串** Markdown 工具（无 Node fs、无 Octokit），供：

- `@release-toolkit/core` — PR 日志收集（配合 changelog 插件）
- `@release-toolkit/app-server` — Worker 评论与 PR 描述体格式化
- `@release-toolkit/changelog-presets` — commit emoji 常量

## 导出

| 模块 | 说明 |
|------|------|
| `markers` | `RELEASE_LOG_*`、`OUTPUT_*`、评论锚点常量 |
| `toBulletLines` | 文本 → `-` 列表行 |
| `applyEmojiPrefixToLine` | conventional commit 行加 emoji |
| `formatTitleBulletLine` | `- {title}（标题）`，可接 `formatLine` |
| `formatChangeLogBulletsPlain` | 无插件：列表 + emoji |
| `formatChangeLogBulletsFromBody` | 可注入 body 转换（core 接插件） |
| `parseReleaseLog` | 解析 `## pkg` 分组 RELEASE-LOG |
| `extractReleaseLogFromBody` | 从 PR body 截取标记区 |
| `OUTPUT_MARKERS` | `{ START, END }` 与 `OUTPUT_*` 常量 |
| `wrapOutputMarkers` / `upsertOutputInBody` | PR 描述体输出区幂等更新 |
