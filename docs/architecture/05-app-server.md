# GitHub App 服务端详解 (@release-toolkit/app-server)

## 实现状态总览

| 功能 | 状态 | 说明 |
|------|------|------|
| Webhook 签名验证 | ✅ 已实现 | HMAC-SHA256 + 常量时间比较 |
| PR 事件处理 | ✅ 已实现 | `opened`/`reopened`/`synchronize`/`edited`/`ready_for_review` |
| PR 评论提醒 | ✅ 已实现 | `commentOnPR()` |
| 触发 GitHub Actions | ✅ 已实现 | `triggerWorkflow()` |
| GitHub App JWT 认证 | ✅ 已实现 | RS256 算法生成 JWT |
| Installation Token 获取 | ✅ 已实现 | `getInstallationToken()` |
| 处理其他事件类型 | 🔲 规划中 | 如 `push`、`issues` 等 |
| Web UI 集成 | 🔲 规划中 | 提供可视化管理界面 |

---

## 模块结构

```
packages/app-server/
├── src/
│   └── index.ts              # 完整服务端（单文件）
├── wrangler.toml             # Cloudflare Workers 配置
└── package.json
```

> **注意**：app-server 是单文件实现，所有逻辑都在 `src/index.ts` 中，不存在 `handlers/` 子目录拆分。

---

## 核心功能

- 验证 GitHub Webhook 签名（HMAC-SHA256）
- 处理 `pull_request` 事件
- 触发 GitHub Actions workflow
- 生成 GitHub App JWT Token (RS256)

---

## 入口文件

```typescript
// packages/app-server/src/index.ts
export default {
  async fetch(request, env): Promise<Response> {
    // 1. 仅处理 POST 请求
    // 2. 验证 X-Hub-Signature-256 签名
    // 3. 解析 webhook 事件
    // 4. 分发到 handleEvent
  }
}
```

---

## 内部函数列表

| 函数 | 说明 |
|------|------|
| `verifySignature` | HMAC-SHA256 签名验证 |
| `hex` | ArrayBuffer 转 hex 字符串 |
| `safeEqual` | 常量时间字符串比较（防时序攻击） |
| `handleEvent` | 核心事件处理器：根据 action 类型分发处理 |
| `commentOnPR` | PR 创建时在 PR 上发评论提醒用户批准 |
| `triggerWorkflow` | 触发 GitHub Actions workflow (`pr-log-collector.yml`) |
| `getInstallationToken` | 获取 GitHub App installation access token |
| `generateJWT` | 生成 GitHub App JWT (RS256) |
| `importPrivateKey` | 导入 PEM 私钥为 CryptoKey |
| `base64urlEncode` | Base64 URL 编码 |

### 内部接口

```typescript
interface WebhookEvent {
  action?: string;
  pull_request?: {
    number: number;
    // ...
  };
  installation?: {
    id: number;
  };
}
```

---

## Webhook 事件处理逻辑

```
POST 请求到达
    ↓
verifySignature — 验证签名
    ↓
解析 WebhookEvent
    ↓
handleEvent(event, env)
    ↓
┌─────────────────────────────────────────────────────┐
│  pull_request 事件                                   │
│                                                     │
│  action = "opened" | "reopened"                     │
│    → commentOnPR() — 在 PR 上发评论提醒用户批准      │
│                                                     │
│  action = "synchronize" | "edited" | "ready_for_review" │
│    → triggerWorkflow() — 触发 pr-log-collector.yml  │
│                                                     │
│  其他 action                                        │
│    → 跳过                                           │
└─────────────────────────────────────────────────────┘
```

---

## GitHub App 认证流程

```
1. importPrivateKey(env.GITHUB_APP_PRIVATE_KEY)
   → 导入 PEM 私钥为 CryptoKey

2. generateJWT(appId, privateKey)
   → 使用 RS256 算法生成 JWT

3. getInstallationToken(jwt, installationId)
   → 获取 installation access token

4. 使用 token 调用 GitHub API
   → commentOnPR / triggerWorkflow
```

---

## 部署

使用 Cloudflare Workers 部署：

```bash
# 安装 wrangler
npm install -g wrangler

# 登录
wrangler login

# 部署
wrangler deploy
```

---

## 环境变量

| 变量 | 说明 |
|------|------|
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_WEBHOOK_SECRET` | Webhook 签名密钥 |
| `GITHUB_APP_PRIVATE_KEY` | GitHub App PEM 私钥 |

---

## 依赖

- 无内部依赖（仅开发时需要 `wrangler` 和 `@cloudflare/workers-types`）
- 运行时使用 Web Crypto API（Cloudflare Workers 内置）
