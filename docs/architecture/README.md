# Release Toolkit 架构文档

> 全部文档的统一入口见 [../README.md](../README.md)。实施目标架构时必须以 [../implementation/README.md](../implementation/README.md) 为任务规格；本目录也保留当前实现说明，不能将其误认为最终设计。

## 项目概述

**Release Toolkit** 是一个 **CI 驱动的 Monorepo 发布工具链**，用于自动化收集 PR 变更日志、聚合版本发布、创建 GitHub Release。

| 属性      | 值                |
| --------- | ----------------- |
| 项目名称  | `release-toolkit` |
| 包管理器  | pnpm@11.3.0       |
| Node 版本 | >=24.0.0          |
| 模块格式  | ESM (TypeScript)  |
| 构建工具  | tsdown            |
| 许可证    | MIT               |

## 文档目录

- [01-overview.md](./01-overview.md) - 项目概览与目录结构
- [02-core-module.md](./02-core-module.md) - 核心模块详解（含共享类型、导出 API）
- [03-cli-module.md](./03-cli-module.md) - CLI 模块详解
- [04-presets-module.md](./04-presets-module.md) - 预设格式化器详解
- [05-app-server.md](./05-app-server.md) - GitHub App 服务端详解
- [06-workflows.md](./06-workflows.md) - 工作流程详解
- [07-config-and-plugin.md](./07-config-and-plugin.md) - 配置系统与插件系统详解
- [08-markdown-package.md](./08-markdown-package.md) - 共享 Markdown 模块（`@release-toolkit/markdown`）
- [09-release-plan-architecture.md](./09-release-plan-architecture.md) - 发布计划中心架构（目标设计）
- [../implementation/README.md](../implementation/README.md) - AI 可执行实施规格、阶段任务与验收标准

## 架构阅读顺序

如果要实施目标架构，建议按以下顺序阅读：

1. [../implementation/README.md](../implementation/README.md)：读取完整需求、数据契约、任务和验收。
2. [09-release-plan-architecture.md](./09-release-plan-architecture.md)：理解目标模型和职责边界。
3. [01-overview.md](./01-overview.md)：了解当前 monorepo 包结构。
4. [06-workflows.md](./06-workflows.md)：对照当前已有的 PR、预览和发布流程。
5. 按任务阶段阅读 `02` 至 `08` 的对应模块文档。

## 快速开始

```bash
# 安装依赖
pnpm install

# 使用 CLI
npx release preview --help
npx release publish --help
```
