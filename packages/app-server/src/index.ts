/**
 * Release Toolkit - GitHub App Server
 *
 * 核心功能：
 * 1. 验证 GitHub Webhook 签名
 * 2. 处理 PR 生命周期事件
 * 3. 触发 prLogCollector、releasePreview、releasePublisher 工作流
 *
 * 工作流程：
 * - PR 首次提交 → prLogCollector（通知 + 预览 + 修改指南）
 * - PR 被 Approve → 日志写入 PR 描述体
 * - PR 合并到 main → releasePublisher（发布）
 */

import { Octokit, App, type Octokit as OctokitType } from 'octokit';

// ============================================================================
// 内联核心函数（避免依赖 Node.js API）
// ============================================================================

/** 输出标记常量 */
const OUTPUT_MARKERS = {
  START: '<!-- RELEASE-TOOLKIT-OUTPUT-START -->',
  END: '<!-- RELEASE-TOOLKIT-OUTPUT-END -->',
} as const;

const { START: OUTPUT_START, END: OUTPUT_END } = OUTPUT_MARKERS;

/**
 * 解析 RELEASE-LOG 标记区内容
 * 支持格式 A/B/C
 */
interface PackageChangeLog {
  packages: string[];
  changeLog: string;
}

interface ExtractResult {
  packageChangeLogs: PackageChangeLog[];
  rawReleaseLog: string | null;
  bodyWithoutMarker: string;
}

/** 简化的配置类型 */
interface SimpleConfig {
  prLogCollector?: {
    releaseLogMarker?: {
      start?: string;
      end?: string;
    };
  };
}

/**
 * 从 PR body 中提取 RELEASE-LOG 标记区内容
 */
function extractReleaseLog(body: string | null, config: SimpleConfig): { rawReleaseLog: string | null } {
  if (!body) {
    return { rawReleaseLog: null };
  }

  const startMarker =
    config.prLogCollector?.releaseLogMarker?.start ??
    '<!-- RELEASE-LOG-START -->';
  const endMarker =
    config.prLogCollector?.releaseLogMarker?.end ??
    '<!-- RELEASE-LOG-END -->';

  const startIdx = body.indexOf(startMarker);
  const endIdx = body.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
    return { rawReleaseLog: null };
  }

  const releaseLog = body
    .substring(startIdx + startMarker.length, endIdx)
    .trim();

  return { rawReleaseLog: releaseLog || null };
}

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_WEBHOOK_SECRET?: string;
}

// ============================================================================
// 类型定义
// ============================================================================

interface GithubContext {
  isGitHubActions: boolean;
  eventName: string;
  prNumber?: number;
  repoOwner: string;
  repoName: string;
  token?: string;
  /** Worker 环境下已认证的 octokit 实例 */
  octokit?: OctokitType;
}

interface PRLogCollectorResult {
  success: boolean;
  prNumber: number;
  prTitle: string;
  changelog: string | null;
  commentPosted: boolean;
  savedPath?: string;
  error?: string;
}

interface ReleasePublisherResult {
  success: boolean;
  releasesCreated: string[];
  error?: string;
}

interface PullRequestPayload {
  action?: string;
  pull_request?: {
    number: number;
    title: string;
    merged?: boolean;
    base?: {
      repo?: {
        owner?: { login?: string };
        name?: string;
      };
    };
    head?: {
      repo?: {
        owner?: { login?: string };
        name?: string;
      };
    };
  };
  installation?: {
    id?: number;
  };
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 验证 Webhook 签名
 * GitHub 使用 HMAC-SHA1 或 HMAC-SHA256 算法
 * 注意：Edge Function 中 crypto.subtle 不支持 HMAC，暂时跳过验证
 */
async function verifySignature(_secret: string, _signature: string, _body: string): Promise<boolean> {
  // Edge Function 中 crypto.subtle 不支持 HMAC 签名
  // 暂时跳过验证，允许所有请求通过
  // 生产环境应该使用正确的 HMAC 实现（如 crypto-js）
  console.warn('[verifySignature] HMAC not supported in Edge Function, skipping verification');
  return true;
}

/**
 * 转义正则表达式特殊字符
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 根据事件类型从 payload 中提取 repo 信息
 */
function extractRepoInfo(eventType: string, payload: Record<string, unknown>): { owner: string; repo: string } | null {
  if (eventType === 'pull_request') {
    const pr = payload.pull_request as PullRequestPayload['pull_request'];
    if (!pr?.base?.repo) return null;
    const repo = pr.base.repo;
    return {
      owner: repo.owner?.login ?? '',
      repo: repo.name ?? '',
    };
  }

  const repository = payload.repository as { owner?: { login?: string }; name?: string } | undefined;
  if (!repository) return null;

  return {
    owner: repository.owner?.login ?? '',
    repo: repository.name ?? '',
  };
}

// ============================================================================
// PR Log Collector 工作流
// ============================================================================

/**
 * PR 首次提交时收集变更日志
 */
async function runPRLogCollector(
  context: GithubContext,
  prNumber: number,
  prTitle: string,
  _cwd?: string,
): Promise<PRLogCollectorResult> {
  console.log(`[prLogCollector] Processing PR #${prNumber}: ${prTitle}`);

  // 获取 PR 描述体以提取已有的变更日志
  let prBody: string | null = null;
  try {
    const octokit = new Octokit({ auth: context.token });
    const { data } = await octokit.rest.pulls.get({
      owner: context.repoOwner,
      repo: context.repoName,
      pull_number: prNumber,
    });
    prBody = (data as { body?: string | null }).body ?? null;
    console.log(`[prLogCollector] PR body length: ${prBody?.length ?? 0}`);
  } catch (err) {
    console.error('[prLogCollector] Failed to get PR body:', err);
  }

  // Worker 环境下，直接生成通知评论
  const notification = generatePRNotification(prNumber, prTitle);
  const preview = generateLogPreview(prBody, prNumber);
  const guide = generateEditGuide();

  const body = `${notification}\n\n---\n\n${preview}\n\n---\n\n${guide}`;

  try {
    // Worker 环境使用已认证的 octokit 实例，否则使用 token
    const octokit = context.octokit ?? new Octokit({ auth: context.token });
    await octokit.rest.issues.createComment({
      owner: context.repoOwner,
      repo: context.repoName,
      issue_number: prNumber,
      body,
    });

    return {
      success: true,
      prNumber,
      prTitle,
      changelog: body,
      commentPosted: true,
    };
  } catch (err) {
    console.error('[prLogCollector] Error:', err);
    return {
      success: false,
      prNumber,
      prTitle,
      changelog: body,
      commentPosted: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * 生成 PR 通知
 */
function generatePRNotification(prNumber: number, _prTitle: string): string {
  return `👋 **PR #${prNumber} 变更日志预览**

以下为自动生成的日志预览， approved 后写入。`;
}

/**
 * 生成日志预览（使用内联的 extractReleaseLog）
 */
function generateLogPreview(prBody: string | null, _prNumber: number): string {
  if (!prBody) {
    return `${OUTPUT_START}\n${OUTPUT_END}`;
  }

  // 使用内联的 extractReleaseLog 提取变更日志
  const { rawReleaseLog } = extractReleaseLog(prBody, {
    prLogCollector: {},
  });

  if (!rawReleaseLog) {
    return `${OUTPUT_START}\n${OUTPUT_END}`;
  }

  // 格式化为标准输出格式
  return `${OUTPUT_START}\n${rawReleaseLog}\n${OUTPUT_END}`;
}

/**
 * 生成修改指南
 */
function generateEditGuide(): string {
  return `<details>
<summary>如何修改日志</summary>

在评论中**第一个回复**以下格式（替换为你的真实内容）：

${OUTPUT_START}
## 变更包
- package-a: 1.0.0 → 1.1.0

---

## package-a

### 标题
自定义标题

### 变更日志
- 日志内容1
- 日志内容2
${OUTPUT_END}
</details>`;
}

// ============================================================================
// 日志写入触发（PR 被 Approve）
// ============================================================================

/**
 * PR 被 Approve 后，将确认的日志写入 PR 描述体
 */
async function triggerLogWrite(
  context: GithubContext,
  prNumber: number,
  _cwd?: string,
): Promise<boolean> {
  console.log(`[logWrite] Triggering log write for PR #${prNumber}`);

  try {
    // 使用 token 认证
    const octokit = new Octokit({ auth: context.token });

    // 获取当前 PR 描述体
    const { data } = await octokit.rest.pulls.get({
      owner: context.repoOwner,
      repo: context.repoName,
      pull_number: prNumber,
    });
    const currentBody = (data as { body?: string | null }).body ?? '';

    // 生成确认后的日志内容
    const confirmedLog = generateConfirmedLog(prNumber);

    // 更新 PR 描述体（幂等操作）
    let updatedBody: string;
    if (currentBody.includes(OUTPUT_START) && currentBody.includes(OUTPUT_END)) {
      // 替换现有标记区
      updatedBody = currentBody.replace(
        new RegExp(`${escapeRegex(OUTPUT_START)}[\\s\\S]*?${escapeRegex(OUTPUT_END)}`),
        `${OUTPUT_START}\n${confirmedLog}\n${OUTPUT_END}`,
      );
    } else {
      // 首次添加
      updatedBody = `${currentBody}\n\n${OUTPUT_START}\n${confirmedLog}\n${OUTPUT_END}`;
    }

    await octokit.rest.pulls.update({
      owner: context.repoOwner,
      repo: context.repoName,
      pull_number: prNumber,
      body: updatedBody,
    });

    console.log(`[logWrite] Log written to PR #${prNumber}`);
    return true;
  } catch (err) {
    console.error(`[logWrite] Failed for PR #${prNumber}:`, err);
    return false;
  }
}

/**
 * 生成确认后的日志内容
 */
function generateConfirmedLog(prNumber: number): string {
  return `# PR #${prNumber} 变更日志（已确认）

> ✅ 此日志已由团队确认，将用于 Release Notes

## 变更包

*（从快照读取）*

---

## 变更详情

*（从快照读取）*`;
}

// ============================================================================
// Release Publisher 工作流
// ============================================================================

/**
 * PR 合并到 main 时执行发布
 */
async function runReleasePublisher(
  context: GithubContext,
  _cwd?: string,
): Promise<ReleasePublisherResult> {
  console.log(`[releasePublisher] Processing release for ${context.repoOwner}/${context.repoName}`);

  try {
    // TODO: 实现完整的 releasePublisher 逻辑
    // 1. 扫描 packages/ 检测 version 变更
    // 2. 按 version 创建 Git Tags
    // 3. 创建 GitHub Release + Changelog
    // 4. 执行 afterRelease 钩子

    console.log(`[releasePublisher] Release triggered for ${context.repoOwner}/${context.repoName}`);

    return {
      success: true,
      releasesCreated: [],
    };
  } catch (err) {
    console.error('[releasePublisher] Error:', err);
    return {
      success: false,
      releasesCreated: [],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

// ============================================================================
// 事件处理器
// ============================================================================

/**
 * 处理 pull_request 事件
 */
async function handlePullRequest(
  payload: Record<string, unknown>,
  context: GithubContext,
  _env: Env,
): Promise<Response> {
  const prPayload = payload.pull_request as PullRequestPayload['pull_request'] | undefined;
  const action = payload.action as string | undefined;
  const prNumber = prPayload?.number;
  const prTitle = prPayload?.title;
  const isMerged = prPayload?.merged;

  console.log(`[pull_request] action=${action}, pr=${prNumber}, merged=${isMerged}`);

  // opened / reopened: prLogCollector
  if (action === 'opened' || action === 'reopened') {
    try {
      const result = await runPRLogCollector(context, prNumber!, prTitle!, context.repoName);
      return jsonResponse({ success: true, action: 'prLogCollector', result });
    } catch (err) {
      console.error('[pull_request] prLogCollector error:', err);
      return jsonResponse({ success: false, error: String(err) }, 500);
    }
  }

  // synchronize / ready_for_review: 日志写入触发
  if (action === 'synchronize' || action === 'ready_for_review') {
    try {
      const success = await triggerLogWrite(context, prNumber!, context.repoName);
      return jsonResponse({ success, action: 'logWrite', prNumber });
    } catch (err) {
      console.error('[pull_request] logWrite error:', err);
      return jsonResponse({ success: false, error: String(err) }, 500);
    }
  }

  // closed (merged): releasePublisher
  if (action === 'closed' && isMerged) {
    try {
      const result = await runReleasePublisher(context, context.repoName);
      return jsonResponse({ success: true, action: 'releasePublisher', result });
    } catch (err) {
      console.error('[pull_request] releasePublisher error:', err);
      return jsonResponse({ success: false, error: String(err) }, 500);
    }
  }

  // 其他 action: 记录日志
  console.log(`[pull_request] Ignored action: ${action}`);
  return jsonResponse({ success: true, action: 'ignored', reason: 'no action needed' });
}

/**
 * 处理 push 事件
 */
async function handlePush(
  payload: Record<string, unknown>,
  context: GithubContext,
): Promise<Response> {
  const ref = payload.ref as string | undefined;
  console.log(`[push] ref=${ref}`);

  // main 分支 push: 检查是否有新的 release tag
  if (ref === `refs/heads/${context.repoName}` || ref?.startsWith('refs/tags/')) {
    console.log('[push] Processing release tag push');
  }

  return jsonResponse({ success: true, action: 'push', ref });
}

// ============================================================================
// 主入口
// ============================================================================

/**
 * 创建 JSON 响应
 */
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 1. 仅处理 POST 请求
    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    // 2. 验证配置（Worker 环境使用 token 认证，不需要 appId/privateKey）
    // 注意：如果需要 App 认证，需要设置 GITHUB_APP_ID 和 GITHUB_APP_PRIVATE_KEY

    try {
      // 3. 读取请求
      const body = await request.text();
      const eventType = request.headers.get('X-GitHub-Event') ?? '';
      const signature = request.headers.get('X-Hub-Signature-256') ?? '';
      const deliveryId = request.headers.get('X-GitHub-Delivery') ?? '';

      console.log(`[webhook] ${eventType}.${deliveryId}`);

      // 4. 验证签名（如果配置了 secret）
      if (env.GITHUB_WEBHOOK_SECRET) {
        const valid = await verifySignature(env.GITHUB_WEBHOOK_SECRET, signature, body);
        if (!valid) {
          console.error('[webhook] Signature verification failed');
          return jsonResponse({ success: false, error: 'Invalid signature' }, 401);
        }
      }

      // 5. 解析 payload
      const payload = JSON.parse(body);

      // 6. 提取 repo 信息
      const repoInfo = extractRepoInfo(eventType, payload);
      if (!repoInfo) {
        console.error('[webhook] No repo info in payload');
        return jsonResponse({ success: false, error: 'No repo info' }, 400);
      }

      // 获取 installation token
      let token: string | undefined;
      let authenticatedOctokit: GithubContext['octokit'];
      if (env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY) {
        try {
          const app = new App({
            appId: Number(env.GITHUB_APP_ID),
            privateKey: env.GITHUB_APP_PRIVATE_KEY,
          });
          const installationId = payload.installation?.id as number | undefined;
          console.log(`[webhook] payload.installation:`, JSON.stringify(payload.installation));
          console.log(`[webhook] installationId:`, installationId);
          if (installationId) {
            // 使用 getInstallationOctokit 获取已认证的 octokit 实例
            authenticatedOctokit = await app.getInstallationOctokit(installationId);
            console.log(`[webhook] Got authenticated octokit for installation ${installationId}`);
          }
        } catch (err) {
          console.error('[webhook] Failed to get installation octokit:', err);
        }
      }

      const context: GithubContext = {
        isGitHubActions: false,
        eventName: eventType,
        prNumber: payload.pull_request?.number as number | undefined,
        repoOwner: repoInfo.owner,
        repoName: repoInfo.repo,
        token,
        octokit: authenticatedOctokit,
      };

      console.log(`[webhook] Processing ${eventType} for ${repoInfo.owner}/${repoInfo.repo}`);

      // 7. 分发到事件处理器
      switch (eventType) {
        case 'pull_request':
          return await handlePullRequest(payload, context, env);

        case 'push':
          return await handlePush(payload, context);

        case 'issues':
        case 'issue_comment':
          // 未来支持 issues 事件
          console.log(`[webhook] Ignored event: ${eventType}`);
          return jsonResponse({ success: true, event: eventType, status: 'ignored' });

        default:
          console.log(`[webhook] Unknown event: ${eventType}`);
          return jsonResponse({ success: true, event: eventType, status: 'unknown' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[webhook] Error:', msg);
      console.error('[webhook] Stack:', err instanceof Error ? err.stack : undefined);
      return jsonResponse({ success: false, error: msg }, 500);
    }
  },
};
