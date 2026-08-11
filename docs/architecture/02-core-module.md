# 核心模块详解 (@release-toolkit/core)

## 实现状态总览

| 模块 | 状态 | 说明 |
|------|------|------|
| `features/pr-log-collector` | ✅ 已实现 | PR 日志收集器（更新 PR 描述体） |
| `features/release-preview` | ✅ 已实现 | 发布预览（评论 PR） |
| `features/release-publisher` | ✅ 已实现 | 发布执行器（Tag + Release + 钩子） |
| `shared/types` | ✅ 已实现 | 核心共享类型 |
| `shared/config` | ✅ 已实现 | 配置加载（`branches.base` 单分支） |
| `shared/github` | ✅ 已实现 | GitHub API 客户端 |
| `shared/git` | ✅ 已实现 | Git 操作 |
| `shared/plugins` | ✅ 已实现 | `ChangelogFormatter` + `IPlugin` 加载器 |
| `shared/hook-runner` | ✅ 已实现 | 调用插件 `beforeCollect/afterCollect/...` 钩子 |
| `IPlugin` 通用插件接口 | ✅ 类型已就位 | 内置 preset 暂未实现生命周期钩子 |
| `ILogParser` 自定义日志解析 | ✅ 已实现 | `loadLogParser` 已接入配置；默认解析仍走 `parseChangelog` |
| 配置继承（`.local/config.json`） | ✅ 已实现 | 多配置文件 deepMerge |

---

## 模块结构

```
packages/core/src/
├── features/                          # 三大核心功能
│   ├── pr-log-collector/              # PR 日志收集器
│   │   ├── collector.ts               # 主入口 — collectPRLog()
│   │   ├── release-log-extractor.ts   # 解析 RELEASE-LOG 标记区
│   │   ├── package-log-format.ts      # 标题/列表项渲染（委托 @release-toolkit/markdown + 插件）
│   │   ├── index.ts                   # barrel
│   │   └── types.ts                   # PRLogCollectorOptions, PRMeta
│   │
│   ├── release-preview/               # 发布预览
│   │   ├── previewer.ts               # 主入口 — previewRelease()
│   │   ├── workspace-scanner.ts       # 读取 pnpm-workspace.yaml
│   │   ├── formatter.ts               # 评论格式化
│   │   ├── index.ts
│   │   └── types.ts
│   │
│   └── release-publisher/             # 发布执行器
│       ├── publisher.ts               # 主入口 — publishRelease()
│       ├── github-release.ts          # 创建 GitHub Release
│       ├── tag-manager.ts             # Git tag 创建/推送
│       ├── hook-runner.ts             # afterRelease/beforeTag 配置钩子
│       ├── index.ts
│       └── types.ts
│
├── shared/                            # 共享模块
│   ├── types.ts                       # DiffType, IPlugin, ChangelogFormatter, *Result 等
│   ├── utils.ts                       # IS_WORKER, OUTPUT_MARKERS, escapeRegex, parseGithubRepository
│   ├── hook-runner.ts                 # 插件生命周期钩子调度
│   ├── version.ts                     # detectVersionChanges, resolvePackageDirs
│   ├── workspace.ts                   # scanWorkspace
│   ├── changelog-aggregator.ts        # 聚合 .release-toolkit/releases/
│   ├── config/
│   │   └── index.ts                   # loadConfig, BranchesConfig, ReleaseToolkitConfig
│   ├── github/
│   │   ├── api-client.ts              # getPR, getPullRequests, updatePR, ...
│   │   ├── pr-commenter.ts            # postOrUpdateComment
│   │   ├── context-detector.ts        # detectGithubContext
│   │   ├── octokit.ts                 # createOctokit
│   │   └── types.ts                   # OctokitInstance, PullRequestData, IssueCommentData
│   ├── git/
│   │   └── git-reader.ts              # diffFiles, showFileContent, getCurrentSha, createTag, pushTags
│   └── plugins/
│       ├── index.ts                   # barrel
│       ├── loader.ts                  # loadPlugins / loadPluginsAsIPlugin / applyFormatters
│       ├── types.ts                   # ChangelogFormatter, IPlugin 等
│       └── utils.ts                   # parseChangelog
│
├── constants.ts                       # 常量定义（DEFAULT_PLUGINS、DIFF_TYPE_LABELS 等）
└── index.ts                           # 统一导出
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
| `shared/types` | `DiffType`, `PackageVersionInfo`, `VersionDiffResult`, `GithubContext`, `ChangelogEntry`, `IPlugin`, `ILogParser`, `ILineFormatter`, `ILogFormatter`, `ChangelogFormatter` |
| `shared/config` | `ReleaseToolkitConfig`, `BranchesConfig`, `PRLogCollectorConfig`, `ReleasePreviewConfig`, `ReleasePublisherConfig`, `AfterReleaseHook`, `GitTagsConfig` |
| `shared/github/pr-commenter` | `PRCommenterOptions` |
| `features/pr-log-collector/types` | `PRLogCollectorOptions`, `PRLogCollectorResult`, `PRMeta` |
| `features/release-preview/types` | `ReleasePreviewOptions`, `ReleasePreviewResult`, `PackageVersionDiff` |
| `features/release-publisher/types` | `ReleasePublisherOptions`, `ReleasePublisherResult`, `ReleaseHookContext` |

### 值导出

| 来源 | 导出名 |
|------|--------|
| `shared/config` | `loadConfig`, `CONFIG_DIR`, `CONFIG_FILE`, `DEFAULT_CONFIG` |
| `shared/utils` | `IS_WORKER`, `parseGithubRepository`；`OUTPUT_MARKERS` / `escapeRegex` / `upsertOutputInBody` 再导出自 `@release-toolkit/markdown` |
| `shared/github/api-client` | `createOctokit`, `getPR`, `getPRComments`, `createPRComment`, `updatePRComment`, `updatePR` |
| `shared/github/pr-commenter` | `postOrUpdateComment` |
| `shared/github/context-detector` | `detectGithubContext` |
| `shared/git/git-reader` | `diffFiles`, `showFileContent`, `getCurrentSha`, `createTag`, `pushTags` |
| `shared/plugins` | `loadPlugins`, `loadPluginsAsIPlugin`, `loadLogParser`, `applyFormatters`, `applyFormatLine`, `parseChangelog` |
| `features/pr-log-collector` | `collectPRLog`, `extractReleaseLog` |
| `features/release-preview` | `previewRelease` |
| `features/release-publisher` | `publishRelease` |
