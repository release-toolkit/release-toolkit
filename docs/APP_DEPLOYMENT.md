# Release Toolkit App - 部署和配置指南

> 本文主体是当前 App Server 部署方式。目标 Release Plan 流程的事件、权限和 workflow 改造按 [implementation/README.md](./implementation/README.md) P6/P7 执行；在目标代码完成前，不要按下述目标增量宣称部署完成。

## 1. 部署 Cloudflare Worker

```bash
cd packages/app-server

# 设置私钥（一次性操作）
cat /path/to/private-key.pem | npx wrangler secret put GITHUB_APP_PRIVATE_KEY

# 部署
pnpm run deploy
```

部署成功后会输出 Worker URL，例如：

```
https://release-toolkit-app.your-subdomain.workers.dev
```

---

## 2. 配置 GitHub App

访问：https://github.com/settings/apps/（选择你的 App）

### General 页面：

- **Webhook URL**: 填入上一步的 Worker URL
- **Webhook secret**: 与 `wrangler secret put GITHUB_WEBHOOK_SECRET` 设置的值保持一致

### Permissions & events 页面：

**Permissions**:

- Pull requests: **Read & write**
- Contents: **Read & write**（如果需要修改 PR 描述体）
- Metadata: **Read-only**

**Subscribe to events**:

- ☑️ Pull request（必须勾选）
- ☑️ Pull request review（如果需要监听审批）

点击 **Save changes**

---

## 3. 验证 Webhook 是否工作

### 方法 1：查看 Cloudflare Worker 日志

```bash
cd packages/app-server
npx wrangler tail
```

然后创建一个测试 PR，观察日志输出。

### 方法 2：查看 GitHub App 的 Webhook 交付

在 GitHub App 设置 → **Advanced** 页面，可以看到最近的 webhook 交付记录。

---

## 4. 测试流程

1. 创建 PR 到 `dev` 分支（或与 `RELEASE_BASE_BRANCH` 一致的分支）
2. 检查 PR 下方是否有评论：
   - 顶部状态：「📢 **PR 待审批**」或「✅ **PR 已批准**」
   - 包含变更包版本表、变更日志预览、修改指南
3. 如果没有评论，检查：
   - Cloudflare Worker 日志
   - GitHub App 的 Webhook 交付记录
   - 是否有错误信息

---

## 常见问题

### Q: Webhook 交付显示 401 Unauthorized

**A**: Webhook secret 不匹配，检查 `wrangler.toml` 和 GitHub App 设置中的 secret 是否一致。

### Q: Webhook 交付显示 500 Internal Server Error

**A**: 检查 Cloudflare Worker 日志，可能是私钥配置错误。

### Q: App 已部署但没有收到 Webhook

**A**: 检查 GitHub App 的 Webhook URL 是否配置正确。

---

## 5. 本地开发（可选）

如果需要本地测试，可以使用 [smee.io](https://smee.io/) 转发 webhook：

```bash
# 安装 smee-client
npm install --global smee-client

# 转发 webhook 到本地
smee --url https://smee.io/your-unique-url --target http://localhost:8787
```

然后在 GitHub App 设置中，将 Webhook URL 设置为 smee.io 的 URL。

---

## 6. 目标 Release Plan 流程的部署增量

目标流程需要额外处理 Release PR 工具评论和 workflow dispatch：

- GitHub App 权限：Pull requests read/write、Issues read/write、Contents read/write、Actions read/write、Metadata read；
- Webhook 事件：Pull request、Issue comment；旧 Pull request review 仅兼容模式需要；
- Actions：`release-collect`、`release-prepare`、`release-refresh`、`release-publish`、`release-retry`；
- `release/*` 必须是同仓库受保护分支，fork PR 不得运行带发布 secret 的 workflow；
- publish workflow 建议绑定 GitHub Environment approval，并使用最小权限 token；
- 同一 Release PR 的 refresh 使用 concurrency group，避免 checkbox 和日志覆盖。

部署验收必须真实验证 Feature PR 收集、网页 Prepare Release、评论修改、Release PR 合并、selected matrix 和失败重试，不能只验证 Worker 返回 200。
