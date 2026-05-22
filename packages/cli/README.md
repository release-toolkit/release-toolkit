# @release-toolkit/cli

CLI 入口，提供 `release` 命令调用 `@release-toolkit/core` 的三大功能。

## 安装

```bash
pnpm add -D @release-toolkit/cli
# 或
npx @release-toolkit/cli --help
```

## 命令

| 命令 | 说明 |
|------|------|
| `release collect`  | 在 PR 描述体中写入结构化变更日志（prLogCollector） |
| `release preview`  | 检测版本变更 + 聚合日志，并以评论形式输出预览 |
| `release publish`  | 创建 Git Tag + GitHub Release + 执行 `afterRelease` 钩子 |

所有命令均会自动加载 `.release-toolkit/config.json`。

## 使用示例

```bash
# PR 日志收集（在 CI 中常用）
release collect \
  --pr-number 123 \
  --owner my-org \
  --repo my-repo

# 版本预览（默认评论到 PR）
release preview \
  --pr-number 123 \
  --owner my-org \
  --repo my-repo

# 执行发布（一般由 release-publish.yml workflow 调用）
release publish
```

## 发布流程钩子执行顺序

`publish` 命令按以下顺序触发钩子：

1. **beforePublish** —— 插件生命周期钩子（`IPlugin.beforePublish`）
2. **beforeTag** —— `config.releasePublisher.beforeTag`（command / script / package）
3. **createTags** —— 为每个版本变更创建 Git Tag
4. **createGithubRelease** —— 创建 GitHub Release（除非 `createGithubRelease: false` 或 `--dry-run`）
5. **afterRelease** —— `config.releasePublisher.afterRelease`
6. **afterPublish** —— 插件生命周期钩子（`IPlugin.afterPublish`）

> `prLogCollector` 与 `releasePreview` 各有 `beforeCollect/afterCollect`、`beforePreview/afterPreview` 插件钩子。

## CI 集成示例

仓库内提供了模板，可直接使用：

- [`.github/workflows/release-publish.yml`](../../.github/workflows/release-publish.yml) — 由 Cloudflare Worker 通过 `workflow_dispatch` 触发
- [`.github/workflows/release-collect.yml`](../../.github/workflows/release-collect.yml) — 不依赖 Worker，PR 事件直接在 CI 上执行 `release collect`
