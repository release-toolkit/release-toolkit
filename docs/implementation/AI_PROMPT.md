# 交给实施 AI 的任务提示

请在当前 `release-toolkit` 仓库中完整实现 Release Plan v1。

执行前必须按顺序完整阅读：

1. `docs/README.md`
2. `docs/implementation/README.md`
3. `docs/architecture/09-release-plan-architecture.md`
4. 当前阶段涉及的 `docs/architecture/01` 至 `08`
5. 当前源码、测试、配置和 GitHub Actions

实施要求：

- 以 `docs/implementation/README.md` 的 FR-01 至 FR-18、P0 至 P9、测试矩阵和需求追踪矩阵作为验收合同。
- 按 P0 至 P9 顺序实施；每个阶段完成后运行该阶段测试并更新文档状态。
- 不得把现有 `collect/preview/publish` 行为误认为目标架构已经完成。
- 不得缩减 Feature PR 日志循环、`release/*` PR、一级 package checkbox、Release Plan、workspace 联动、版本解析、selected-only Action matrix、失败重试和消费状态机。
- 保持当前用户未提交改动；不要覆盖无关文件。
- 未经明确授权，不要 commit、push、创建 PR 或执行真实发布。
- 遇到 GitHub 平台交互不确定性时，先执行 P0 真实平台验证；不得用推测宣称完成。
- 最终逐条提交 FR、端到端场景和文档一致性审计，不得只报告测试通过。

完成条件是目标行为已经由当前代码、测试、workflow 和文档共同证明，而不是只创建类型、接口或占位文件。
