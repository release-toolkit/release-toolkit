# Release Toolkit 三阶段架构实现总结

## 完成时间
2026-05-02 11:10

## 架构概览

### 三阶段设计

```
PR 提交到 dev → Stage 1: 收集 PR 信息并更新评论
         ↓
PR 合并到 dev → Stage 2: 检测 version 变更并生成 release 信息
         ↓
PR 提交到 main → Stage 3: 发布 GitHub Release 并执行 hooks
```

---

## 核心实现

### 1. Stage 1: PR Changelog 收集器

**文件**: `packages/core/src/stages/stage1-pr-collector.ts`

**功能**:
- 从 GitHub API 获取 PR 数据
- 渲染 changelog markdown
- 保存快照到 `.releasetoolkit/changelog/prs/`
- 发布/更新 PR 评论

**CLI 命令**:
```bash
release pr-changelog fetch --pr-number <N> --save --skip-if-exists --post-comment
```

**工作流**: `.github/workflows/stage1-pr-changelog.yml`

---

### 2. Stage 2: Release 准备器

**文件**: `packages/core/src/stages/stage2-release-preparer.ts`

**功能**:
- 检测 `packages/*/package.json` 的 version 变更
- 收集所有保存的 PR changelog 快照
- 构建统一的 release changelog
- 保存 release 信息到 `.releasetoolkit/release/info.json`

**CLI 命令**:
```bash
release prepare --base main --dev dev
release prepare --no-save  # 只预览不保存
```

**工作流**: `.github/workflows/stage2-release-prepare.yml`

---

### 3. Stage 3: Release 发布器

**文件**: `packages/core/src/stages/stage3-release-publisher.ts`

**功能**:
- 读取 Stage 2 保存的 release 信息
- 消费所有保存的 PR changelog 快照
- 构建统一的 Release Changelog
- 写入 per-package CHANGELOG.md
- 创建 git tags
- 创建 GitHub Releases
- 执行 `afterRelease` hooks
- 更新 PR 评论标记为已发布

**CLI 命令**:
```bash
release ci
release ci --dry-run
```

**工作流**: `.github/workflows/stage3-release-publish.yml`

---

## 架构优势

### 1. 逻辑与 CLI 完全剥离

**之前**: 业务逻辑混杂在 CLI 命令中
**现在**: 每个 Stage 都是独立的类，CLI 只负责参数解析

**好处**:
- 易于测试（直接实例化类并调用方法）
- 易于扩展（可以轻松添加新步骤或修改执行顺序）
- 易于复用（可以在不同场景下调叫同一个 Stage）

### 2. 可配置的执执行顺序

每个 Stage 类的方法都是独立的私有方法，未来可以轻松：
- 调整步骤顺序
- 添加/删除步骤
- 替换某个步骤的实现

**示例（Stage 3 的步骤）**:
```typescript
// 当前顺序
Step 0: detectGitHubContext()
Step 1: loadReleaseInfo()
Step 2: consumeSnapshots()
Step 3: buildChangelog()
Step 4: writePackageChangelogs()
Step 5: createTags()
Step 6: createReleases()
Step 7: updatePRComment()
Step 8: saveSummary()
```

### 3. 配置系统

**3 级合并策略**:
1. **默认值** - 硬编码的默认配置
2. **配置文件** - `.releasetoolkit/config.json`
3. **显式选项** - CLI 参数或环境变量（最高优先级）

**配置文件示例**:
```json
{
  "devBranch": "dev",
  "baseRef": "main",
  "createTags": true,
  "createRelease": true,
  "afterRelease": ["./scripts/post-release.sh"],
  "prChangelog": {
    "packagesDir": "packages",
    "rootTag": "root"
  }
}
```

---

## 文件清单

### 新增文件

1. `packages/core/src/stages/stage1-pr-collector.ts`
2. `packages/core/src/stages/stage2-release-preparer.ts`
3. `packages/core/src/stages/stage3-release-publisher.ts`
4. `packages/cli/src/commands/prepare.command.ts`
5. `.github/workflows/stage1-pr-changelog.yml`
6. `.github/workflows/stage2-release-prepare.yml`
7. `.github/workflows/stage3-release-publish.yml`
8. `docs/ARCHITECTURE.md`
9. `docs/IMPLEMENTATION-SUMMARY.md`

### 修改文件

1. `packages/core/src/index.ts` - 导出新的 Stage 类
2. `packages/core/src/changelog/release/index.ts` - 导出 `VersionDiffResult` 类型
3. `packages/cli/src/index.ts` - 注册 `prepare` 命令
4. `packages/cli/src/commands/pr-changelog.command.ts` - 使用 `Stage1PRCollector`
5. `packages/cli/src/commands/ci.command.ts` - 使用 `Stage3ReleasePublisher`
6. `.github/workflows/release.yml` - 重命名为 `stage3-release-publish.yml` 并更新

---

## 使用示例

### 本地测试

```bash
# Stage 1: 收集 PR 信息
release pr-changelog fetch --pr-number 1 --save --skip-if-exists --post-comment

# Stage 2: 准备 release 信息
release prepare --base main --dev dev

# Stage 3: 发布 release
release ci
release ci --dry-run  # 预览模式
```

### CI/CD

**Stage 1** (`.github/workflows/stage1-pr-changelog.yml`):
- 触发: PR 提交到 `dev` 分支
- 执行: 收集 PR 信息并更新评论

**Stage 2** (`.github/workflows/stage2-release-prepare.yml`):
- 触发: PR 合并到 `dev` 分支
- 执行: 检测 version 变更并生成 release 信息

**Stage 3** (`.github/workflows/stage3-release-publish.yml`):
- 触发: PR 合并到 `main` 分支
- 执行: 发布 GitHub Release 并执行 hooks

---

## 后续优化建议

1. **添加单元测试**: 为每个 Stage 类添加单元测试
2. **完善错误处理**: 添加更详细的错误信息和恢复机制
3. **支持更多配置选项**: 如自定义 changelog 模板、通知渠道等
4. **添加日志记录**: 使用专业的日志库（如 `winston`）替代 `console.log`
5. **性能优化**: 对于大型 monorepo，优化快照加载和 changelog 生成性能

---

## 故障排查

### Stage 1 失败

**症状**: PR 评论未更新

**检查**:
1. `GITHUB_TOKEN` 权限是否足够（需要 `pull-requests: write`）
2. `--post-comment` 选项是否添加
3. 查看 Actions 日志

### Stage 2 未触发

**症状**: 合并到 `dev` 后没有生成 release 信息

**检查**:
1. `packages/*/package.json` 的 version 是否变更
2. 工作流触发条件是否正确
3. 查看 Actions 日志

### Stage 3 失败

**症状**: Tags 或 Releases 未创建

**检查**:
1. `GITHUB_TOKEN` 权限是否足够（需要 `contents: write`)
2. `.releasetoolkit/release/info.json` 是否存在
3. `afterRelease` hooks 是否可执行
4. 查看 Actions 日志

---

## 总结

✅ **已完成**:
1. 设计并实现三阶段架构
2. 将 CLI 和核心逻辑完全剥离
3. 创建 3 个 Stage 核心类
4. 创建 3 个对应的 CLI 命令
5. 创建 3 个 GitHub Actions 工作流
6. 更新配置系统支持三阶段
7. 编写详细的架构文档

✅ **构建状态**: 所有包构建成功

✅ **代码质量**: 逻辑清晰，易于维护和扩展

🎉 **项目现在拥有了一个清晰、可扩展的三阶段发布架构！**
