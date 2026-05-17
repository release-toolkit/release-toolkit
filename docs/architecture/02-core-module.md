# 核心模块详解 (@release-toolkit/core)

## 实现状态总览

| 模块 | 状态 | 说明 |
|------|------|------|
| `features/pr-log-collector` | ✅ 已实现 | PR 日志收集器 |
| `features/release-preview` | ✅ 已实现 | 发布预览 |
| `features/release-publisher` | ✅ 已实现 | 发布执行器 |
| `shared/types` | ✅ 已实现 | 核心共享类型 |
| `shared/config` | ✅ 已实现 | 配置加载 |
| `shared/github` | ✅ 已实现 | GitHub API 客户端 |
| `shared/git` | ✅ 已实现 | Git 操作 |
| `shared/plugins` | ✅ 已实现 | 插件系统（ChangelogFormatter） |
| 生命周期钩子（beforeXxx/afterXxx） | 🔲 规划中 | 通过 IPlugin 接口实现 |
| `IPlugin` 通用插件接口 | 🔲 规划中 | 扩展生命周期钩子 |
| `ILogParser` 自定义日志解析 | 🔲 规划中 | 替换默认解析逻辑 |

---

## 模块结构

```
packages/core/src/
├── features/                    # 三大核心功能
│   ├── pr-log-collector/        # PR 日志收集器
│   │   ├── collector.ts         # 主入口 — collectPRLog()
│   │   ├── release-log-extractor.ts
│   │   ├── formatter.ts
│   │   └── types.ts             # PRLogCollectorOptions, PRLogCollectorResult, PRMeta
│   │
│   ├── release-preview/         # 发布预览
│   │   ├── previewer.ts         # 主入口 — previewRelease()
│   │   ├── version-detector.ts
│   │   ├── workspace-scanner.ts
│   │   ├── log-aggregator.ts
│   │   ├── formatter.ts
│   │   └── types.ts             # ReleasePreviewOptions, ReleasePreviewResult, PackageVersionDiff
│   │
│   └── release-publisher/       # 发布执行器
│       ├── publisher.ts         # 主入口 — publishRelease()
│       ├── github-release.ts
│       ├── tag-manager.ts
│       ├── hook-runner.ts
│       └── types.ts             # ReleasePublisherOptions, ReleasePublisherResult, ReleaseHookContext
│
├── shared/                      # 共享模块
│   ├── types.ts                 # 核心共享类型（DiffType, PackageVersionInfo 等）
│   ├── config/                  # 配置加载
│   │   └── index.ts             # loadConfig, ReleaseToolkitConfig, CONFIG_DIR, CONFIG_FILE, DEFAULT_CONFIG
│   ├── github/                  # GitHub API 客户端
│   │   ├── api-client.ts        # getOctokit, getPR, getPRComments, createPRComment, updatePRComment
│   │   ├── pr-commenter.ts      # postOrUpdateComment, PRCommenterOptions
│   │   ├── context-detector.ts  # detectGithubContext
│   │   └── types.ts             # OctokitInstance, PullRequestData, IssueCommentData
│   ├── git/                     # Git 操作
│   │   └── git-reader.ts        # diffFiles, showFileContent, getCurrentSha, createTag, pushTags
│   └── plugins/                 # 插件系统
│       ├── index.ts             # loadPlugins, applyFormatters
│       ├── loader.ts            # 插件加载逻辑
│       ├── types.ts             # ChangelogFormatter, LoadedPlugins
│       └── utils.ts             # parseChangelog
│
├── constants.ts                 # 常量定义
└── index.ts                     # 统一导出
```

---

## 核心共享类型 (`shared/types.ts`)

| 类型 | 种类 | 说明 |
|------|------|------|
| `DiffType` | 联合类型 | `'major' \| 'minor' \| 'patch' \| null` — 版本差异级别 |
| `PackageVersionInfo` | interface | `{ packageName, packagePath, currentVersion, newVersion }` |
| `VersionDiffResult` | interface | `{ package: PackageVersionInfo, diffType: DiffType }` |
| `GithubContext` | interface | `{ isGitHubActions, eventName, prNumber?, repoOwner?, repoName?, token?, baseRef?, headRef? }` |

---

## GitHub 模块类型 (`shared/github/types.ts`)

| 类型 | 种类 | 说明 |
|------|------|------|
| `OctokitInstance` | 类型别名 | `InstanceType<typeof Octokit>` — Octokit 实例类型 |
| `PullRequestData` | interface | PR 数据：`number?, title?, body?, html_url?, base?, head?, user?` |
| `IssueCommentData` | interface | 评论数据：`id?, body?, user?, created_at?` |

---

## 插件模块类型 (`shared/plugins/types.ts`)

| 类型 | 种类 | 说明 |
|------|------|------|
| `ChangelogFormatter` | interface | `{ name: string, format?(entries) => string, formatLine?(line) => string }` |
| `LoadedPlugins` | interface | `{ formatters: ChangelogFormatter[] }` |

### ChangelogFormatter 详解

```typescript
interface ChangelogFormatter {
  /** 格式化器名称，用于配置引用 */
  name: string;

  /** 整体格式化：将条目列表格式化为完整 changelog 文本 */
  format?: (entries: Array<{ type: string; scope?: string; subject: string }>) => string;

  /** 单行格式化：对单行 changelog 文本进行格式化 */
  formatLine?: (line: string) => string;
}
```

### parseChangelog 工具函数

```typescript
// shared/plugins/utils.ts
function parseChangelog(text: string): Array<{ type: string; scope?: string; subject: string }>
```

逐行匹配以 `- ` 开头的行，用正则提取 `type/scope/subject`；无法解析的行归类为 `type: 'other'`。

---

## 依赖

- `js-yaml` — YAML 解析
- `semver` — 语义化版本处理
- `simple-git` — Git 操作
- `@release-toolkit/changelog-presets` — 预设格式化器
- `octokit` — GitHub API

---

## 导出 API (`index.ts`)

使用精确导出（非 `export *`），分为类型导出和值导出：

### 类型导出

| 来源 | 类型 |
|------|------|
| `shared/types` | `DiffType`, `PackageVersionInfo`, `VersionDiffResult`, `GithubContext` |
| `shared/config` | `ReleaseToolkitConfig` |
| `shared/github/pr-commenter` | `PRCommenterOptions` |
| `features/pr-log-collector/types` | `PRLogCollectorOptions`, `PRLogCollectorResult`, `PRMeta` |
| `features/release-preview/types` | `ReleasePreviewOptions`, `ReleasePreviewResult`, `PackageVersionDiff` |
| `features/release-publisher/types` | `ReleasePublisherOptions`, `ReleasePublisherResult`, `ReleaseHookContext` |

### 值导出

| 来源 | 导出名 |
|------|--------|
| `shared/config` | `loadConfig`, `CONFIG_DIR`, `CONFIG_FILE`, `DEFAULT_CONFIG` |
| `shared/github/api-client` | `getOctokit`, `getPR`, `getPRComments`, `createPRComment`, `updatePRComment` |
| `shared/github/pr-commenter` | `postOrUpdateComment` |
| `shared/github/context-detector` | `detectGithubContext` |
| `shared/git/git-reader` | `diffFiles`, `showFileContent`, `getCurrentSha`, `createTag`, `pushTags` |
| `features/pr-log-collector` | `collectPRLog` |
| `features/release-preview` | `previewRelease` |
| `features/release-publisher` | `publishRelease` |

### 未从主入口导出的模块

以下模块存在于 `shared/plugins/` 但未从 `index.ts` 重新导出，需通过 `core/shared/plugins` 路径单独导入：

| 导出名 | 类型 | 说明 |
|--------|------|------|
| `loadPlugins` | 函数 | 根据配置加载格式化器插件 |
| `applyFormatters` | 函数 | 应用已加载的格式化器 |
| `ChangelogFormatter` | 类型 | 格式化器接口 |
| `LoadedPlugins` | 类型 | 已加载插件集合 |
| `parseChangelog` | 函数 | 解析 changelog 文本为结构化条目 |

同样，`shared/github/types.ts` 中的 `OctokitInstance`、`PullRequestData`、`IssueCommentData` 也未从主入口导出。
