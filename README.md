# Release Toolkit

CI 驱动的 **Monorepo 发布工具链** —— 自动收集 PR 变更日志、聚合版本发布、创建 GitHub Release。

---

## 核心功能

本工具围绕 `pull_request` 和 `push` 事件，为 Monorepo 项目提供三个核心能力：
**PR 日志收集（`prLogCollector`）** → **发布预览（`releasePreview`）** → **发布执行（`releasePublisher`）**。

### 一、`prLogCollector`：PR 日志收集（面向开发分支，如 `dev`）

**触发条件**：当向指定的开发分支（如 `- base: dev`）提交或更新 PR 时。

**执行动作**：
- 自动提取当前 PR 的 **标题（header）** 作为变更摘要
- 自动读取当前 PR 的 **首个评论中的指定区域**（通过 `<!-- RELEASE-LOG-START -->` / `<!-- RELEASE-LOG-END -->` 标记）作为详细说明
- 将上述内容格式化后，**幂等更新回当前 PR 的描述体（body）**（使用 `<!-- RELEASE-TOOLKIT-OUTPUT-START -->` / `<!-- RELEASE-TOOLKIT-OUTPUT-END -->` 标记区，每次 PR 变更都自动同步）
- 同时**保存快照**到 `.release-toolkit/releases/pr{prNumber}-{时间戳}.md`，供后续 `releasePreview` 聚合使用

> 作用：让每个 PR 在合并前都沉淀一份结构化的变更记录，作为后续发布日志的数据源。

---

### 二、`releasePreview`：版本发布预览（面向生产分支，如 `main`）

**触发条件**：当向指定的生产分支（如 `- base: main`）提交或更新 PR 时。

**执行动作**：
- 仅针对 **Monorepo 项目**，监听范围根据根目录 `pnpm-workspace.yaml` 中声明的 `packages/*` 自动推断
- 检查 `packages/` 下各子包是否存在**版本号变更**（`package.json` 的 `version` 字段 diff）：
  - ✅ **存在版本变更**：聚合 `prLogCollector` 沉淀的所有 PR 变更日志，格式化后评论到当前 PR，每次 PR 更新时自动同步
  - ⚠️ **不存在版本变更**：在 PR 中评论明确的「无版本更新」提示，避免误发布

> 作用：合并到生产分支前提供最终的发布预览，确保版本号与变更日志完全对齐。

---

### 三、`releasePublisher`：自动发布与后置钩子（PR 合并后）

**触发条件**：当 `releasePreview` 对应的 PR 被合并到生产分支（如 `main`）时。

**执行动作**：
- 根据 `releasePreview` 聚合的变更日志，自动创建对应版本的 **GitHub Release**
- 发布完成后，触发用户配置的 **`afterRelease` 钩子回调**，支持自定义扩展（如 `npm publish`、通知推送、部署触发等）

> 作用：将「合并即发布」作为最后一步固化到 CI，实现端到端的自动化交付。

---

## 工作流程总览

```
┌──────────────────────────────────────────────────────────────────┐
│  开发分支 PR (→ dev)                                              │
│    ├─ prLogCollector：收集 PR 标题 + RELEASE-LOG 标记区内容      │
│    └─ 幂等更新到当前 PR 描述体（body）                                      │
└──────────────────────────────────────────────────────────────────┘
                           ⬇ 合并
┌──────────────────────────────────────────────────────────────────┐
│  生产分支 PR (→ main)                                             │
│    ├─ releasePreview：基于 pnpm-workspace.yaml 检测版本变更       │
│    ├─ 有变更 → 聚合日志 + 评论预览                                │
│    └─ 无变更 → 评论「无版本更新」提示                             │
└──────────────────────────────────────────────────────────────────┘
                           ⬇ 合并
┌──────────────────────────────────────────────────────────────────┐
│  releasePublisher：创建 GitHub Release + 执行 afterRelease 钩子   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 项目配置

工具支持通过 **`.release-toolkit/config.json`** 统一配置三大核心功能的行为。该文件位于项目根目录，所有字段均为可选，未配置时使用下方默认值。

### 配置文件位置

```
<项目根目录>/.release-toolkit/config.json
```

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

| 配置项 | 类型 | 默认值 | 所属功能 | 说明 |
|--------|------|--------|----------|------|
| `devBranch` | `string` | `"dev"` | `prLogCollector` | 触发 PR 日志收集的目标分支 |
| `productionBranch` | `string` | `"main"` | `releasePreview` / `releasePublisher` | 触发版本预览与发布的目标分支 |
| `prLogCollector.releaseLogMarker.start` | `string` | `"<!-- RELEASE-LOG-START -->"` | `prLogCollector` | 从 PR 首个评论提取内容的起始标记 |
| `prLogCollector.releaseLogMarker.end` | `string` | `"<!-- RELEASE-LOG-END -->"` | `prLogCollector` | 从 PR 首个评论提取内容的结束标记 |
| `releasePreview.workspaceFile` | `string` | `"pnpm-workspace.yaml"` | `releasePreview` | 定义 Monorepo 子包范围的文件 |
| `releasePreview.noChangeMessage` | `string` | 内置中文提示 | `releasePreview` | 无版本变更时评论到 PR 的提示内容 |
| `releasePublisher.createGithubRelease` | `boolean` | `true` | `releasePublisher` | 是否创建 GitHub Release |
| `releasePublisher.afterRelease` | `string[]` | `[]` | `releasePublisher` | 发布成功后顺序执行的 Shell 命令列表 |

### 零配置也可工作

若项目根目录不存在 `.release-toolkit/config.json`，工具将**完全使用默认值**运行，无需任何额外配置。

---

## License

MIT
