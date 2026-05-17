# 配置系统与插件系统详解

## 实现状态总览

| 模块 | 状态 | 说明 |
|------|------|------|
| 配置加载 (`loadConfig`) | ✅ 已实现 | 从 `.release-toolkit/config.json` 加载配置 |
| `ReleaseToolkitConfig` 类型 | ✅ 已实现 | 配置类型定义 |
| `DEFAULT_CONFIG` | ✅ 已实现 | 默认配置常量 |
| 配置继承 | 🔲 规划中 | 多配置文件继承机制 |
| `ChangelogFormatter` | ✅ 已实现 | 日志格式化器接口 |
| `loadPlugins` / `applyFormatters` | ✅ 已实现 | 插件加载和应用 |
| `IPlugin` 通用插件接口 | 🔲 规划中 | 扩展生命周期钩子的插件接口 |
| `ILogParser` 自定义日志解析 | 🔲 规划中 | 替换默认 changelog 解析逻辑 |
| `ILineFormatter` / `ILogFormatter` | 🔲 规划中 | 更细粒度的日志格式化接口 |

---

## 配置文件位置

`.release-toolkit/config.json`

---

## 支持的配置项

| 配置项 | 默认值 | 状态 | 说明 |
|--------|--------|------|------|
| `branches.dev` | `"dev"` | ✅ | 触发 PR 日志收集的目标分支 |
| `branches.production` | `"main"` | ✅ | 触发版本预览与发布的目标分支 |
| `prLogCollector.releaseLogMarker` | `<!-- RELEASE-LOG-START/END -->` | ✅ | PR 日志标记 |
| `prLogCollector.outputSections` | 全部启用 | ✅ | 控制输出哪些区块 |
| `releasePreview.workspaceFile` | `"pnpm-workspace.yaml"` | ✅ | Monorepo 配置文件 |
| `releasePreview.noChangeMessage` | 内置中文提示 | ✅ | 无版本变更时的提示 |
| `releasePublisher.createGithubRelease` | `true` | ✅ | 是否创建 GitHub Release |
| `releasePublisher.gitTags` | 内置格式 | 🔲 规划中 | Git Tag 格式配置 |
| `releasePublisher.afterRelease` | - | 🔲 规划中 | 发布后钩子 |
| `plugins` | 默认插件列表 | ✅ | 自定义格式化器插件 |

> ✅ = 已在代码中实现 | 🔲 = 文档定义，待实现

---

## 完整配置示例

```json
{
  "$schema": "https://ui.release-toolkit.dev/schema.json",

  "branches": {
    "dev": "dev",
    "production": "main"
  },

  "prLogCollector": {
    "releaseLogMarker": {
      "start": "<!-- RELEASE-LOG-START -->",
      "end": "<!-- RELEASE-LOG-END -->"
    },
    "outputSections": {
      "notification": true,
      "preview": true,
      "editGuide": true
    },
    "logExtraction": {
      "source": "comment",
      "commentPosition": "first"
    }
  },

  "releasePreview": {
    "workspaceFile": "pnpm-workspace.yaml",
    "noChangeMessage": "⚠️ 此 PR 不包含版本更新",
    "previewOutput": {
      "showVersionDiff": true,
      "showPackageList": true,
      "showChangelog": true
    }
  },

  "releasePublisher": {
    "createGithubRelease": true,
    "gitTags": {
      "format": "{packageName}@{version}",
      "message": "Release {packageName}@{version}"
    },
    "afterRelease": [
      {
        "type": "npm-publish",
        "command": "pnpm -r publish --access public"
      },
      {
        "type": "custom",
        "command": "node scripts/send-slack-notification.js"
      },
      {
        "type": "webhook",
        "url": "https://my-cdn.com/webhook/refresh"
      }
    ]
  },

  "plugins": [
    "emoji-prefix",
    "category-group",
    "markdown-bold"
  ]
}
```

---

## 配置加载流程

```
1. 读取 .release-toolkit/config.json
2. 合并默认配置 (DEFAULT_CONFIG)
3. 验证配置项
4. 加载插件配置
5. 返回 ReleaseToolkitConfig 对象
```

---

## afterRelease 钩子类型 (规划中 🔲)

| 类型 | 说明 | 配置 |
|------|------|------|
| `npm-publish` | 发布到 npm registry | `command` |
| `webhook` | 发送 HTTP 请求 | `url`, `method`, `headers`, `body` |
| `custom` | 执行自定义命令 | `command` |
| `slack` | 发送 Slack 通知 | `channel`, `message` |
| `discord` | 发送 Discord 通知 | `webhookUrl`, `message` |

---

## 环境变量

| 环境变量 | 说明 |
|----------|------|
| `GITHUB_TOKEN` | GitHub API Token |
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App 私钥 |
| `NPM_TOKEN` | npm 发布 Token |

---

## 配置继承 (规划中 🔲)

支持从多个配置文件继承：

```
.release-toolkit/
├── config.json          # 主配置
└── .local/
    └── config.json      # 本地覆盖配置
```

### 配置加载优先级

1. `.release-toolkit/.local/config.json` — 最高优先级
2. 环境变量
3. `.release-toolkit/config.json`
4. 默认配置 (`DEFAULT_CONFIG`) — 最低优先级

---

# 插件系统

## 插件类型总览

| 接口 | 状态 | 说明 |
|------|------|------|
| `ChangelogFormatter` | ✅ 已实现 | 日志格式化器（当前唯一支持的插件接口） |
| `IPlugin` | 🔲 规划中 | 通用插件接口，支持生命周期钩子 |
| `ILogParser` | 🔲 规划中 | 自定义日志解析器 |
| `ILineFormatter` | 🔲 规划中 | 单行格式化接口（比 `formatLine` 更细粒度） |
| `ILogFormatter` | 🔲 规划中 | 整体日志格式化接口（比 `format` 更细粒度） |

---

## ChangelogFormatter (已实现 ✅)

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

- `format` — 用于整体格式化，如按类型分组输出
- `formatLine` — 用于单行格式化，如添加 emoji 前缀

---

## IPlugin 通用插件接口 (规划中 🔲)

```typescript
interface IPlugin {
  name: string;
  version?: string;

  // 生命周期钩子
  beforeCollect?(context: ReleaseHookContext): Promise<void>;
  afterCollect?(context: ReleaseHookContext, result: PRLogCollectorResult): Promise<void>;
  beforePreview?(context: ReleaseHookContext): Promise<void>;
  afterPreview?(context: ReleaseHookContext, result: ReleasePreviewResult): Promise<void>;
  beforePublish?(context: ReleaseHookContext): Promise<void>;
  afterPublish?(context: ReleaseHookContext, result: ReleasePublisherResult): Promise<void>;

  // 格式化器（兼容 ChangelogFormatter）
  format?: (entries: ChangelogEntry[]) => string;
  formatLine?: (line: string) => string;

  // 自定义日志解析（规划中）
  parseLog?: (text: string) => ChangelogEntry[];
}
```

### 生命周期钩子执行顺序

```
prLogCollector:
  beforeCollect → collectPRLog → afterCollect

releasePreview:
  beforePreview → previewRelease → afterPreview

releasePublisher:
  beforePublish → publishRelease → afterPublish
```

---

## ILogParser 自定义日志解析 (规划中 🔲)

```typescript
interface ILogParser {
  name: string;

  /** 解析原始 changelog 文本为结构化条目 */
  parse(text: string): ChangelogEntry[];

  /** 可选：提取额外元数据 */
  extractMetadata?(entries: ChangelogEntry[]): Record<string, unknown>;
}
```

用于替换默认的 `parseChangelog` 函数，实现自定义解析逻辑。

---

## ILineFormatter / ILogFormatter (规划中 🔲)

```typescript
/** 单行格式化接口 */
interface ILineFormatter {
  name: string;

  /** 格式化单行，返回格式化后的行 */
  formatLine(line: string): string;

  /** 可选：正则表达式匹配特定行 */
  linePattern?: RegExp;
}

/** 整体日志格式化接口 */
interface ILogFormatter {
  name: string;

  /** 格式化整个 changelog 文本 */
  format(log: string): string;

  /** 可选：处理分组 */
  groupBy?: (entry: ChangelogEntry) => string;
}
```

---

## 插件加载流程

```typescript
// 加载插件
const loaded: LoadedPlugins = loadPlugins(config.plugins);

// 应用格式化器
const output = applyFormatters(loaded, entries);
```

### 插件加载优先级

1. 内置插件（`emoji-prefix`, `category-group`, `markdown-bold`）
2. npm 模块名

---

## 内置插件

### emoji-prefix

根据 commit type 添加 emoji 前缀：

| Type | Emoji |
|------|-------|
| feat | ✨ |
| fix | 🐛 |
| docs | 📝 |
| style | 💄 |
| refactor | ♻️ |
| perf | ⚡️ |
| test | ✅ |
| build | 📦️ |
| ci | 👷 |
| chore | 🔧 |
| revert | ⏪️ |

### category-group

按类型分组输出：

- Features (✨)
- Bug Fixes (🐛)
- Performance (⚡️)
- Styles (💄)
- Documentation (📝)
- Tests (✅)
- Build (📦️)
- CI (👷)
- Misc (🔧)
- Refactor (♻️)
- Reverts (⏪️)

### markdown-bold

Markdown 粗体格式化：

```markdown
**feat: 新功能**
**fix: 修复bug**
```

---

## 插件配置

```json
{
  "plugins": [
    "emoji-prefix",
    "category-group",
    "markdown-bold"
  ]
}
```

---

## 钩子执行顺序

```
prLogCollector:
  collectPRLog → [ChangelogFormatter.formatLine] → [ChangelogFormatter.format]

releasePreview:
  previewRelease → formatOutput

releasePublisher:
  publishRelease → createTags → createGithubRelease → afterRelease (shell commands)
```

---

## 最佳实践

### 1. 插件命名规范

- 使用 kebab-case: `emoji-prefix`
- 包含功能描述: `category-group`

### 2. 错误处理

插件内部应捕获异常，避免影响其他插件：

```typescript
formatLine(line: string): string {
  try {
    // 业务逻辑
  } catch (error) {
    console.error('[plugin-name] Error:', error);
    return line; // 返回原始行
  }
}
```
