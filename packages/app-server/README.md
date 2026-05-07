# @release-toolkit/app-server

GitHub App 的 Cloudflare Worker 实现，用于接收 GitHub Webhook 事件并触发对应的 CI workflow。

## 架构

```
GitHub PR/事件
   ↓
Cloudflare Worker (app-server)
   ↓ 验签通过后
   ↓ 调用 GitHub API
   ↓ trigger workflow_dispatch
   ↓
GitHub Actions CI
   ↓ 运行 @release-toolkit/core 核心逻辑
```

**App 本身不运行核心逻辑**，只负责：
1. 接收 Webhook
2. 验证签名（HMAC SHA-256）
3. 获取 Installation Token
4. 触发对应的 CI workflow

---

## 已实现功能

| 函数 | 功能 |
|---|---|
| `fetch()` | Cloudflare Worker 入口，接收 Webhook |
| `verifySignature()` | HMAC SHA-256 签名验证 |
| `handleEvent()` | 路由不同 GitHub 事件 |
| `triggerWorkflow()` | 调用 GitHub API 触发 CI |
| `getInstallationToken()` | 获取 installation access token |
| `getInstallationTokenFromRepo()` | 从 repo 名获取 token |
| `generateJWT()` | 生成 GitHub App JWT |
| `importPrivateKey()` | 导入 PEM 格式私钥 |
| `commentOnPR()` | 在 PR 创建时评论提醒批准 |

### 事件处理规则

| 事件 | 动作 | 触发 Workflow |
|---|---|---|
| `pull_request` (opened) | 评论提醒批准 | - |
| `pull_request` (synchronize/edited/ready_for_review) | 触发日志收集 | `pr-log-collector.yml` |
| `push` (to main) | 触发发布预览 | `release-preview.yml` |

---

## 配置说明

### 一、GitHub App 配置

1. 打开 https://github.com/settings/apps
2. 点击 **New GitHub App**
3. 填写：
   - **App name**: `release-toolkit`（或其他名称）
   - **Homepage URL**: `https://github.com/你的用户名/release-toolkit`
   - **Webhook URL**: 部署后填（如 `https://release-toolkit-app.你的账户.workers.dev`）
   - **Webhook secret**: 填写与 `wrangler.toml` 中 `GITHUB_WEBHOOK_SECRET` 一致的值
4. 权限（Repository permissions）：
   - `Contents`: Read & write
   - `Pull requests`: Read & write
   - `Metadata`: Read-only
5. 订阅事件：
   - ✅ Pull request
   - ✅ Push
6. 创建后记录：
   - **App ID**（数字）
   - **Private key**（下载 `.pem` 文件）

### 二、`wrangler.toml` 配置

已配置：
```toml
name = "release-toolkit-app"
type = "javascript"
main = "src/index.ts"

compatibility_date = "2024-01-01"

[vars]
GITHUB_APP_ID = "3589117"
GITHUB_WEBHOOK_SECRET = "rss1102-release-toolkit-webhook-2026"
```

### 三、Secrets（通过 `wrangler secret put` 设置）

```bash
cd packages/app-server

# 设置 App ID（与 GitHub App 页面一致）
npx wrangler secret put GITHUB_APP_ID
# 输入：3589117

# 设置 Private Key（粘贴整个 .pem 文件内容，然后 Ctrl+D）
cat release-toolkit.2026-05-03.private-key.pem | npx wrangler secret put GITHUB_APP_PRIVATE_KEY

# 设置 Webhook Secret（与 GitHub App 配置一致）
echo "rss1102-release-toolkit-webhook-2026" | npx wrangler secret put GITHUB_WEBHOOK_SECRET
```

---

## 部署

```bash
cd packages/app-server

# 本地开发测试
pnpm run dev

# 部署到 Cloudflare
pnpm run deploy
```

部署成功后会得到 URL，例如：
```
https://release-toolkit-app.jimmymyss1102.workers.dev
```

将此 URL 填回到 GitHub App 的 **Webhook URL** 配置中。

---

## 自动部署

当 `packages/app-server/` 下文件改动并推送到 `main` 分支时，会自动触发 `.github/workflows/deploy-app.yml` 部署到 Cloudflare。

**需要设置的 Secrets：**
1. `CLOUDFLARE_API_TOKEN`（从 https://dash.cloudflare.com/profile/api-tokens 生成）
2. `CLOUDFLARE_ACCOUNT_ID`（从 https://dash.cloudflare.com/ 首页右侧复制）

---

## 触发的 Workflow 说明

### `.github/workflows/pr-log-collector.yml`

由 `pull_request` 事件（`synchronize`/`edited`/`ready_for_review`）触发：

```yaml
name: Collect PR Log

on:
  workflow_dispatch:
    inputs:
      pr_number:
        required: true

jobs:
  collect:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: |
          pnpm release-toolkit collect \
            --pr-number ${{ inputs.pr_number }} \
            --owner ${{ github.repository_owner }} \
            --repo ${{ github.repository }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### `.github/workflows/release-preview.yml`

由 `push` 事件（to `main`）触发：

```yaml
name: Preview Release

on:
  workflow_dispatch:

jobs:
  preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: |
          pnpm release-toolkit preview \
            --owner ${{ github.repository_owner }} \
            --repo ${{ github.repository }}
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 测试

### 本地测试

```bash
cd packages/app-server
pnpm run dev

# 生成签名（用于测试）
echo -n "payload" | openssl dgst -sha256 -hmac "rss1102-release-toolkit-webhook-2026" -binary | xxd -p | tr -d '\n'

# 测试端点
curl -X POST http://localhost:8787 \
  -H "Content-Type: application/json" \
  -H "X-GitHub-Event: pull_request" \
  -H "X-Hub-Signature-256: sha256=<上面生成的签名>" \
  -d '{"action":"opened","pull_request":{"number":1,"title":"test","body":null,"base":{"ref":"dev","repo":{"owner":{"login":"test"},"name":"test"}},"head":{"ref":"feat"},"installation":{"id":123}}}
```

### 真实测试

1. 打开你的测试仓库
2. 创建一个 PR（从任意分支到 `dev` 分支）
3. GitHub App 会自动：
   - **第一次创建 PR**：评论提醒批准
   - **PR 更新**：触发 `collect.yml`
4. 查看 GitHub Actions 页面，确认 `collect.yml` 是否运行

---

## 最小实现原则

- ✅ 只负责接收 Webhook + 验签
- ✅ 通过 GitHub API 触发对应的 CI workflow
- ✅ 不运行 `@release-toolkit/core` 核心逻辑（由 CI 运行）
- ✅ 代码保持简洁，不包含冗余逻辑

---

## License

MIT
