# @release-toolkit/core

核心库，提供三个核心功能的底层能力：**PR 日志收集**、**发布预览**、**发布执行**。

## 功能模块

| 模块 | 说明 |
|------|------|
| **prLogCollector** | 收集 PR 日志，更新 PR 描述体，保存快照 |
| **releasePreview** | 检测版本变更，聚合日志，评论到 PR |
| **releasePublisher** | 创建 GitHub Release，执行 afterRelease 钩子 |
| **Config** | 加载和合并配置文件（`.release-toolkit/config.json`） |
| **GitHub** | Octokit 客户端封装，PR 评论管理 |
| **Git** | Git 命令封装（diff、show、tag 等） |

## 安装

```bash
npm install @release-toolkit/core
```

## 使用示例

### 1. PR 日志收集（prLogCollector）

```typescript
import { collectPRLog } from '@release-toolkit/core';

const result = await collectPRLog({
  prNumber: 123,
  owner: 'your-org',
  repo: 'your-repo',
  token: process.env.GITHUB_TOKEN!,
  cwd: process.cwd(),
  save: true, // 保存快照到 .release-toolkit/releases/
});

if (result.success) {
  console.log('PR 日志已收集:', result.prNumber);
} else {
  console.error('收集失败:', result.error);
}
```

### 2. 发布预览（releasePreview）

```typescript
import { previewRelease } from '@release-toolkit/core';

const result = await previewRelease({
  prNumber: 456,
  owner: 'your-org',
  repo: 'your-repo',
  token: process.env.GITHUB_TOKEN!,
  cwd: process.cwd(),
});

if (result.success) {
  console.log('版本变更:', result.hasVersionChange);
  console.log('变更详情:', result.versionDiffs);
}
```

### 3. 发布执行（releasePublisher）

```typescript
import { publishRelease } from '@release-toolkit/core';

const result = await publishRelease({
  cwd: process.cwd(),
  dryRun: false, // true 表示仅预览，不实际创建 Release
});

if (result.success) {
  console.log('发布成功:', result.releases);
} else {
  console.error('发布失败:', result.errors);
}
```

## 配置

工具支持通过 `.release-toolkit/config.json` 统一配置。所有字段均为可选，未配置时使用默认值。

### 完整配置示例

```json
{
  "devBranch": "dev",
  "productionBranch": "main",
  "prLogCollector": {
    "releaseLogMarker": {
      "start": "<!-- RELEASE-LOG-START -->",
      "end": "<!-- RELEASE-LOG-END -->"
    }
  },
  "releasePreview": {
    "workspaceFile": "pnpm-workspace.yaml",
    "noChangeMessage": "⚠️ 本次 PR 未检测到任何包的版本变更，合并后将不会触发发布。"
  },
  "releasePublisher": {
    "createGithubRelease": true,
    "afterRelease": [
      "pnpm -r publish --access public",
      "echo 'release done'"
    ]
  }
}
```

### 配置项说明

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `devBranch` | `string` | `"dev"` | 触发 PR 日志收集的目标分支 |
| `productionBranch` | `string` | `"main"` | 触发版本预览与发布的目标分支 |
| `prLogCollector.releaseLogMarker.start` | `string` | `"<!-- RELEASE-LOG-START -->"` | 从 PR 首个评论提取内容的起始标记 |
| `prLogCollector.releaseLogMarker.end` | `string` | `"<!-- RELEASE-LOG-END -->"` | 从 PR 首个评论提取内容的结束标记 |
| `releasePreview.workspaceFile` | `string` | `"pnpm-workspace.yaml"` | 定义 Monorepo 子包范围的文件 |
| `releasePreview.noChangeMessage` | `string` | 内置中文提示 | 无版本变更时评论到 PR 的提示内容 |
| `releasePublisher.createGithubRelease` | `boolean` | `true` | 是否创建 GitHub Release |
| `releasePublisher.afterRelease` | `string[]` | `[]` | 发布成功后顺序执行的 Shell 命令列表 |

### 零配置也可工作

若项目根目录不存在 `.release-toolkit/config.json`，工具将**完全使用默认值**运行，无需任何额外配置。

## 插件系统

核心功能支持通过插件系统扩展 changelog 格式化能力。内置插件由 `@release-toolkit/changelog-presets` 包提供：

### 内置插件

| 插件名 | 说明 |
|--------|------|
| `emoji-prefix` | 在 changelog 条目前添加 emoji 前缀（如 ✨ feat: 新功能） |
| `category-group` | 按 commit 类型分组（Features、Bug Fixes 等） |
| `markdown-bold` | 将 scope 部分加粗（如 `feat(**scope**): message`） |

### 使用插件

在配置文件中启用插件：

```json
{
  "plugins": ["emoji-prefix", "category-group"]
}
```

### 自定义插件

您可以编写自定义格式化器，然后通过配置加载：

```json
{
  "plugins": [
    "emoji-prefix",
    "/path/to/your/custom-formatter.js"
  ]
}
```

自定义格式化器格式：

```typescript
export const yourFormatter = {
  name: 'your-formatter',
  format: (entries: Array<{ type: string; scope?: string; subject: string }>) => {
    // 返回格式化后的字符串
    return entries.map(entry => `- ${entry.subject}`).join('\n');
  },
  formatLine: (line: string) => {
    // 可选：格式化单行
    return line;
  },
};
```

## API 参考

### collectPRLog(options)

收集 PR 日志并更新 PR 描述体。

**参数**：
- `options.prNumber` (`number`): PR 编号
- `options.owner` (`string`): 仓库所有者
- `options.repo` (`string`): 仓库名称
- `options.token` (`string`): GitHub Token
- `options.cwd` (`string?`): 工作目录，默认为 `process.cwd()`
- `options.save` (`boolean?`): 是否保存快照，默认为 `false`

**返回**：`Promise<PRLogCollectorResult>`
```typescript
interface PRLogCollectorResult {
  success: boolean;
  prNumber: number;
  title: string;
  releaseLog: string | null;
  commentPosted: boolean;
  savedPath?: string;
  error?: string;
}
```

### previewRelease(options)

检测版本变更并生成发布预览。

**参数**：
- `options.prNumber` (`number`): PR 编号
- `options.owner` (`string`): 仓库所有者
- `options.repo` (`string`): 仓库名称
- `options.token` (`string`): GitHub Token
- `options.cwd` (`string?`): 工作目录

**返回**：`Promise<ReleasePreviewResult>`
```typescript
interface ReleasePreviewResult {
  success: boolean;
  prNumber: number;
  hasVersionChange: boolean;
  versionDiffs: PackageVersionDiff[];
  commentPosted: boolean;
  error?: string;
}
```

### publishRelease(options)

执行发布操作（创建 GitHub Release、执行 afterRelease 钩子）。

**参数**：
- `options.cwd` (`string?`): 工作目录
- `options.dryRun` (`boolean?`): 是否仅预览，默认为 `false`

**返回**：`Promise<ReleasePublisherResult>`
```typescript
interface ReleasePublisherResult {
  success: boolean;
  releases: Array<{ packageName: string; tagName: string; releaseUrl?: string }>;
  errors: string[];
}
```

## 导出说明

### 类型导出

```typescript
import type {
  // 共享类型
  DiffType,
  PackageVersionInfo,
  VersionDiffResult,
  GithubContext,
  
  // prLogCollector 类型
  PRLogCollectorOptions,
  PRLogCollectorResult,
  PRMeta,
  
  // releasePreview 类型
  ReleasePreviewOptions,
  ReleasePreviewResult,
  PackageVersionDiff,
  
  // releasePublisher 类型
  ReleasePublisherOptions,
  ReleasePublisherResult,
  ReleaseHookContext,
  
  // 配置类型
  ReleaseToolkitConfig,
} from '@release-toolkit/core';
```

### 函数导出

```typescript
import {
  // 核心功能
  collectPRLog,
  previewRelease,
  publishRelease,
  
  // 配置
  loadConfig,
  
  // GitHub
  getOctokit,
  getPR,
  getPRComments,
  createPRComment,
  updatePRComment,
  postOrUpdateComment,
  detectGithubContext,
  
  // Git
  diffFiles,
  showFileContent,
  getCurrentSha,
  createTag,
  pushTags,
} from '@release-toolkit/core';
```

## 相关包

- `@release-toolkit/cli` - 命令行工具
- `@release-toolkit/changelog-presets` - 内置格式化插件
- `@release-toolkit/app-server` - GitHub App 服务器（WIP）

## License

MIT
