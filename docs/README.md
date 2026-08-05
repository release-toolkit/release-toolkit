# Release Toolkit 文档入口

本目录同时包含当前实现说明、目标架构和实施计划。阅读时必须区分三者，不能把目标设计当成已经完成的代码。

## 文档层级

| 层级     | 文档                                                                                           | 用途                                  |
| -------- | ---------------------------------------------------------------------------------------------- | ------------------------------------- |
| 当前实现 | `architecture/01` 至 `08` 的“当前实现”部分、`APP_DEPLOYMENT.md`                                | 理解现有代码、兼容接口和部署方式      |
| 目标架构 | [architecture/09-release-plan-architecture.md](./architecture/09-release-plan-architecture.md) | 理解最终产品行为和架构边界            |
| 实施规格 | [implementation/README.md](./implementation/README.md)                                         | AI 或开发者实际执行改造的唯一任务入口 |
| AI 提示  | [implementation/AI_PROMPT.md](./implementation/AI_PROMPT.md)                                   | 可直接交给实施 AI 的任务说明          |
| 历史记录 | `history/`                                                                                     | 仅用于追溯，不能作为当前或目标契约    |

## 给实施 AI 的阅读顺序

1. 完整阅读 [implementation/README.md](./implementation/README.md)。
2. 完整阅读 [architecture/09-release-plan-architecture.md](./architecture/09-release-plan-architecture.md)。
3. 阅读 [architecture/01-overview.md](./architecture/01-overview.md) 了解当前包边界。
4. 按实施阶段阅读 `architecture/02` 至 `08` 中对应模块。
5. 检查当前源码、测试、配置、GitHub Actions 和工作区状态，以代码现状作为迁移起点。

## 冲突处理优先级

目标行为发生冲突时，按以下顺序裁决：

1. `implementation/README.md` 中带编号的需求、数据契约和验收标准；
2. `architecture/09-release-plan-architecture.md`；
3. 各模块文档的“目标改造”章节；
4. 当前源码和测试，仅用于说明现状与兼容边界；
5. 历史文档和旧示例。

如果实施规格与目标架构仍然无法确定唯一行为，应先更新文档并获得确认，不要在代码中隐式选择。

## 完成定义

“完成项目”不是指新增几个类型或让现有测试继续通过。必须同时满足：

- `implementation/README.md` 中所有功能需求；
- 每个实施阶段的交付物和验证项；
- Feature PR、Release PR、checkbox、workspace 联动、版本解析、Action matrix、发布重试的端到端验收；
- 当前兼容行为按迁移章节保留或明确废弃；
- 文档、配置 schema、CLI help、示例 workflow 与实现一致。
