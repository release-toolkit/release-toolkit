# Release Toolkit 架构文档

## 项目概述

**Release Toolkit** 是一个 **CI 驱动的 Monorepo 发布工具链**，用于自动化收集 PR 变更日志、聚合版本发布、创建 GitHub Release。

| 属性 | 值 |
|------|-----|
| 项目名称 | `release-toolkit` |
| 包管理器 | pnpm@9.15.0 |
| Node 版本 | >=24.0.0 |
| 模块格式 | ESM (TypeScript) |
| 构建工具 | Vite + vite-plugin-dts |
| 许可证 | MIT |

## 文档目录

- [01-overview.md](./01-overview.md) - 项目概览与目录结构
- [02-core-module.md](./02-core-module.md) - 核心模块详解（含共享类型、导出 API）
- [03-cli-module.md](./03-cli-module.md) - CLI 模块详解
- [04-presets-module.md](./04-presets-module.md) - 预设格式化器详解
- [05-app-server.md](./05-app-server.md) - GitHub App 服务端详解
- [06-workflows.md](./06-workflows.md) - 工作流程详解
- [07-config-and-plugin.md](./07-config-and-plugin.md) - 配置系统与插件系统详解
- [08-markdown-package.md](./08-markdown-package.md) - 共享 Markdown 模块（`@release-toolkit/markdown`）

## 快速开始

```bash
# 安装依赖
pnpm install

# 使用 CLI
npx release preview --help
npx release publish --help
```
