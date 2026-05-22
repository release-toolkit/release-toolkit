# @release-toolkit/types

`release-toolkit` 全局共享的 TypeScript 类型定义。

**纯类型包，无运行时代码**，用于打破 `@release-toolkit/core` 与
`@release-toolkit/changelog-presets` 之间的循环依赖：

```
              ┌─────────────────────────────┐
              │  @release-toolkit/types     │ ← 唯一类型来源
              └──────────┬──────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │                                 │
┌───────▼─────────┐               ┌───────▼─────────────────┐
│ @release-toolkit │               │ @release-toolkit/       │
│ /core            │               │ changelog-presets       │
└──────────────────┘               └─────────────────────────┘
```

## 导出

| 类型 | 说明 |
|------|------|
| `DiffType` | 版本差异级别：`'major' \| 'minor' \| 'patch' \| null` |
| `PackageVersionInfo` | 包版本信息 |
| `VersionDiffResult` | 版本差异结果 |
| `GithubContext` | GitHub Actions / Worker 上下文 |
| `ChangelogEntry` | 单条 changelog 条目（type/scope/subject） |
| `ChangelogFormatter` | 简化的格式化器接口（兼容旧代码） |
| `IPlugin` | 通用插件接口（带生命周期钩子） |
| `ILogParser` | 自定义 changelog 解析器接口 |
| `ILineFormatter` | 单行格式化接口 |
| `ILogFormatter` | 整体日志格式化接口 |
| `LoadedPlugins` / `LoadPluginsResult` | 插件加载器返回值 |
| `ReleaseHookContext` | 发布钩子上下文 |
| `PRLogCollectorResult` / `ReleasePreviewResult` / `ReleasePublisherResult` | 各 feature 的返回类型 |
