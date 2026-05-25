/**
 * Release Toolkit - GitHub App Server (Cloudflare Worker)
 *
 * 职责：
 * 1. 验证 GitHub Webhook 签名（按需）
 * 2. 监听 `pull_request` / `pull_request_review` / `repository_dispatch` 事件
 * 3. 与 `@release-toolkit/core` 的 CLI 输出保持一致的评论格式（共享 `format.ts` 纯函数）
 * 4. 通过 `workflow_dispatch` 触发 CI 完成实际发布
 *
 * 事件 → 行为：
 * - pull_request.opened/reopened/synchronize/edited/ready_for_review（base = RELEASE_BASE_BRANCH）
 *     → upsert PR 评论：通知 + 版本 diff + 预览 + 修改指南
 * - pull_request_review.submitted (state=approved)
 *     → 把当前评论中的预览写入 PR 描述体（`RELEASE-TOOLKIT-OUTPUT` 标记区，幂等）
 * - pull_request.closed (merged && base = RELEASE_BASE_BRANCH)
 *     → 触发 `release-publish` workflow（由 CI 执行 @release-toolkit/core publishRelease）
 * - repository_dispatch (event_type = release-toolkit-collect | write | publish)
 *     → 手动重试入口；通过 `gh api .../dispatches` 触发同样的处理流程
 */

import { isToolCommentBody, wrapToolComment } from '@release-toolkit/markdown';
import {
  type OutputSections,
  type PRContext,
  buildPRComment,
  buildConfirmedReleaseLog,
  resolveOutputSections,
  outputSectionsFromRepoConfig,
  upsertOutputInBody,
} from './format.js';
import { resolvePRVersionState } from './version-resolve.js';
import { resolveReleaseLogForPR } from './log-resolve.js';
import { createGitHubClient, type GitHubClient } from './github-client.js';

// ============================================================================
// 环境与常量
// ============================================================================

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_TOKEN?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  /** 触发收集 / 发布的目标分支（默认 dev） */
  RELEASE_BASE_BRANCH?: string;
  /** 合并后触发的 workflow 文件名（默认 release-publish.yml） */
  RELEASE_PUBLISH_WORKFLOW?: string;
  /**
   * 评论输出区块回退配置（JSON）。
   * 优先使用仓库 `.release-toolkit/config.json` → `prLogCollector.outputSections`。
   */
  OUTPUT_SECTIONS?: string;
}

const DEFAULT_BASE_BRANCH = 'dev';
const DEFAULT_PUBLISH_WORKFLOW = 'release-publish.yml';

// ============================================================================
// 类型定义
// ============================================================================

interface PullRequestPayload {
  action?: string;
  pull_request?: {
    number: number;
    title: string;
    body?: string | null;
    merged?: boolean;
    base?: {
      ref?: string;
      repo?: {
        owner?: { login?: string };
        name?: string;
      };
    };
    head?: {
      ref?: string;
      sha?: string;
    };
  };
  review?: {
    state?: string;
  };
  installation?: {
    id?: number;
  };
}

/**
 * GitHub `repository_dispatch` 事件 payload
 *
 * 用法（CLI / curl）：
 *   gh api repos/<owner>/<repo>/dispatches \
 *     -F event_type=release-toolkit-collect \
 *     -F 'client_payload[pr_number]=123'
 */
interface RepositoryDispatchPayload {
  action?: string;
  event_type?: string;
  client_payload?: {
    pr_number?: number | string;
    action?: 'collect' | 'write' | 'publish';
  };
  repository?: {
    owner?: { login?: string };
    name?: string;
  };
  installation?: {
    id?: number;
  };
}

// ============================================================================
// GitHub API 包装
// ============================================================================

async function getPR(client: GitHubClient, ctx: { owner: string; repo: string; prNumber: number }) {
  return client.getPullRequest(ctx);
}

async function findToolComment(
  client: GitHubClient,
  ctx: { owner: string; repo: string; prNumber: number },
): Promise<number | null> {
  const comments = await client.listIssueComments({
    owner: ctx.owner,
    repo: ctx.repo,
    issueNumber: ctx.prNumber,
  });
  for (const comment of comments) {
    if (isToolCommentBody(comment.body) && typeof comment.id === 'number') {
      return comment.id;
    }
  }
  return null;
}

async function upsertPRComment(
  client: GitHubClient,
  ctx: { owner: string; repo: string; prNumber: number },
  body: string,
): Promise<void> {
  const wrapped = wrapToolComment(body);
  const existingId = await findToolComment(client, ctx);
  if (existingId) {
    await client.updateIssueComment({
      owner: ctx.owner,
      repo: ctx.repo,
      commentId: existingId,
      body: wrapped,
    });
  } else {
    await client.createIssueComment({
      owner: ctx.owner,
      repo: ctx.repo,
      issueNumber: ctx.prNumber,
      body: wrapped,
    });
  }
}

async function updatePRBody(
  client: GitHubClient,
  ctx: { owner: string; repo: string; prNumber: number },
  newBody: string,
): Promise<void> {
  await client.updatePullRequest({
    owner: ctx.owner,
    repo: ctx.repo,
    prNumber: ctx.prNumber,
    body: newBody,
  });
}

async function dispatchWorkflow(
  client: GitHubClient,
  ctx: { owner: string; repo: string },
  workflowFile: string,
  ref: string,
  inputs: Record<string, string>,
): Promise<boolean> {
  try {
    await client.createWorkflowDispatch({
      owner: ctx.owner,
      repo: ctx.repo,
      workflowFile,
      ref,
      inputs,
    });
    return true;
  } catch (err) {
    console.error('[dispatchWorkflow] failed:', err);
    return false;
  }
}

// ============================================================================
// 业务流程
// ============================================================================

async function buildPRContext(
  client: GitHubClient,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PRContext> {
  const pr = await getPR(client, { owner, repo, prNumber });
  return {
    owner,
    repo,
    prNumber,
    prTitle: pr.title ?? '',
    prBody: pr.body ?? null,
    baseRef: pr.base?.ref ?? '',
    headRef: pr.head?.ref ?? '',
    headSha: pr.head?.sha ?? '',
  };
}

const CONFIG_PATH = '.release-toolkit/config.json';

/** 从仓库默认分支或指定 ref 读取 config.json */
async function fetchRepoToolkitConfig(
  client: GitHubClient,
  owner: string,
  repo: string,
  ref: string,
): Promise<Record<string, unknown> | null> {
  try {
    const data = await client.getRepoContent({
      owner,
      repo,
      path: CONFIG_PATH,
      ref,
    });
    if (!data?.content) return null;
    const decoded = atob(data.content.replace(/\n/g, ''));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * 解析评论输出区块：
 * 1. 优先读取 PR head 上 `.release-toolkit/config.json` 的 `prLogCollector.outputSections`
 * 2. 回退到 `OUTPUT_SECTIONS` 环境变量
 * 3. 最后使用默认值
 */
async function resolveOutputSectionsForPR(
  client: GitHubClient,
  prCtx: PRContext,
  env: Env,
): Promise<OutputSections> {
  const ref = prCtx.headSha || prCtx.headRef;
  if (ref) {
    const config = await fetchRepoToolkitConfig(client, prCtx.owner, prCtx.repo, ref);
    const fromRepo = outputSectionsFromRepoConfig(config);
    if (fromRepo) return fromRepo;
  }
  return resolveOutputSections(env.OUTPUT_SECTIONS);
}

async function runCollect(
  client: GitHubClient,
  prCtx: PRContext,
  sections: OutputSections,
  approved = false,
): Promise<{ ok: boolean; commentBody?: string; error?: string }> {
  try {
    const ref = prCtx.headSha || prCtx.headRef;
    const repoConfig = ref
      ? await fetchRepoToolkitConfig(client, prCtx.owner, prCtx.repo, ref)
      : null;
    const { changedPackages, versionDiffs } = await resolvePRVersionState(
      client,
      prCtx,
      repoConfig,
    );
    const { packageChangeLogs } = await resolveReleaseLogForPR(
      client,
      prCtx,
      repoConfig,
    );
    const commentBody = buildPRComment({
      prCtx,
      changedPackages,
      versionDiffs,
      parsedLogs: packageChangeLogs,
      sections,
      approved,
    });
    await upsertPRComment(client, prCtx, commentBody);
    return { ok: true, commentBody };
  } catch (err) {
    console.error('[runCollect] failed:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runConfirmAndWriteToBody(
  client: GitHubClient,
  prCtx: PRContext,
  sections: OutputSections,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ref = prCtx.headSha || prCtx.headRef;
    const repoConfig = ref
      ? await fetchRepoToolkitConfig(client, prCtx.owner, prCtx.repo, ref)
      : null;
    const { changedPackages, versionDiffs } = await resolvePRVersionState(
      client,
      prCtx,
      repoConfig,
    );
    const { packageChangeLogs } = await resolveReleaseLogForPR(
      client,
      prCtx,
      repoConfig,
    );
    const confirmedLog = buildConfirmedReleaseLog(prCtx, changedPackages, versionDiffs, packageChangeLogs);
    const newBody = upsertOutputInBody(prCtx.prBody, confirmedLog);
    if (newBody === prCtx.prBody) return { ok: true };
    await updatePRBody(client, prCtx, newBody);
    // 同时把通知评论刷新为「已批准」
    await runCollect(client, { ...prCtx, prBody: newBody }, sections, true);
    return { ok: true };
  } catch (err) {
    console.error('[runConfirmAndWriteToBody] failed:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runTriggerRelease(
  client: GitHubClient,
  prCtx: PRContext,
  workflowFile: string,
): Promise<{ ok: boolean; error?: string }> {
  const dispatched = await dispatchWorkflow(
    client,
    { owner: prCtx.owner, repo: prCtx.repo },
    workflowFile,
    prCtx.baseRef,
    {
      pr_number: String(prCtx.prNumber),
      pr_title: prCtx.prTitle,
    },
  );
  return dispatched
    ? { ok: true }
    : { ok: false, error: `Failed to dispatch ${workflowFile}` };
}

// ============================================================================
// 事件分发
// ============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function expectedBaseBranch(env: Env): string {
  return env.RELEASE_BASE_BRANCH || DEFAULT_BASE_BRANCH;
}

async function handlePullRequest(
  payload: PullRequestPayload,
  client: GitHubClient,
  env: Env,
): Promise<Response> {
  const action = payload.action;
  const pr = payload.pull_request;
  if (!pr) return jsonResponse({ success: true, status: 'no pull_request payload' });

  const baseRef = pr.base?.ref ?? '';
  const expected = expectedBaseBranch(env);
  if (baseRef !== expected) {
    return jsonResponse({
      success: true,
      status: 'skipped',
      reason: `base ${baseRef} ≠ ${expected}`,
    });
  }

  const owner = pr.base?.repo?.owner?.login ?? '';
  const repo = pr.base?.repo?.name ?? '';
  if (!owner || !repo) {
    return jsonResponse({ success: false, error: 'missing repo in payload' }, 400);
  }

  const prCtx = await buildPRContext(client, owner, repo, pr.number);

  // 合并 + base 命中 → 触发发布 workflow
  if (action === 'closed' && pr.merged) {
    const workflowFile = env.RELEASE_PUBLISH_WORKFLOW || DEFAULT_PUBLISH_WORKFLOW;
    const result = await runTriggerRelease(client, prCtx, workflowFile);
    return jsonResponse({
      success: result.ok,
      action: 'releasePublisher',
      workflow: workflowFile,
      error: result.error,
    });
  }

  // 关闭但未合并 → 不处理
  if (action === 'closed') {
    return jsonResponse({ success: true, action: 'closed-unmerged', status: 'ignored' });
  }

  // 创建 / 同步 → upsert 评论
  if (
    action === 'opened' ||
    action === 'reopened' ||
    action === 'synchronize' ||
    action === 'edited' ||
    action === 'ready_for_review'
  ) {
    const sections = await resolveOutputSectionsForPR(client, prCtx, env);
    const result = await runCollect(client, prCtx, sections);
    return jsonResponse({ success: result.ok, action: 'prLogCollector', error: result.error });
  }

  return jsonResponse({ success: true, action: action ?? 'unknown', status: 'ignored' });
}

/**
 * 处理 `repository_dispatch` 事件 —— 手动重试入口
 *
 * 当 webhook 错过 / 失败时，可以通过
 * `gh api repos/<owner>/<repo>/dispatches -F event_type=release-toolkit-collect ...`
 * 主动触发同样的处理流程。
 */
async function handleRepositoryDispatch(
  payload: RepositoryDispatchPayload,
  client: GitHubClient,
  env: Env,
): Promise<Response> {
  const eventType = payload.event_type ?? '';
  const clientPayload = payload.client_payload ?? {};
  const inferredAction =
    eventType === 'release-toolkit-collect'
      ? 'collect'
      : eventType === 'release-toolkit-write'
        ? 'write'
        : eventType === 'release-toolkit-publish'
          ? 'publish'
          : clientPayload.action;

  if (!inferredAction) {
    return jsonResponse({
      success: true,
      status: 'ignored',
      reason: `unknown event_type: ${eventType}`,
    });
  }

  const owner = payload.repository?.owner?.login ?? '';
  const repo = payload.repository?.name ?? '';
  if (!owner || !repo) {
    return jsonResponse({ success: false, error: 'missing repo in payload' }, 400);
  }

  const prNumber =
    typeof clientPayload.pr_number === 'string'
      ? Number.parseInt(clientPayload.pr_number, 10)
      : clientPayload.pr_number;

  if (inferredAction !== 'publish' && (!prNumber || Number.isNaN(prNumber))) {
    return jsonResponse(
      { success: false, error: 'client_payload.pr_number is required for collect/write' },
      400,
    );
  }

  if (inferredAction === 'publish') {
    const workflowFile = env.RELEASE_PUBLISH_WORKFLOW || DEFAULT_PUBLISH_WORKFLOW;
    const dispatched = await dispatchWorkflow(
      client,
      { owner, repo },
      workflowFile,
      expectedBaseBranch(env),
      {
        pr_number: prNumber ? String(prNumber) : '',
        pr_title: '',
      },
    );
    return jsonResponse({
      success: dispatched,
      action: 'releasePublisher',
      workflow: workflowFile,
    });
  }

  const prCtx = await buildPRContext(client, owner, repo, prNumber!);
  const expected = expectedBaseBranch(env);
  if (prCtx.baseRef !== expected) {
    return jsonResponse({
      success: true,
      status: 'skipped',
      reason: `base ${prCtx.baseRef} ≠ ${expected}`,
    });
  }

  const sections = await resolveOutputSectionsForPR(client, prCtx, env);

  if (inferredAction === 'collect') {
    const result = await runCollect(client, prCtx, sections);
    return jsonResponse({ success: result.ok, action: 'prLogCollector', error: result.error });
  }

  if (inferredAction === 'write') {
    const result = await runConfirmAndWriteToBody(client, prCtx, sections);
    return jsonResponse({ success: result.ok, action: 'logWrite', error: result.error });
  }

  return jsonResponse({ success: true, status: 'ignored', reason: 'unrecognized action' });
}

async function handlePullRequestReview(
  payload: PullRequestPayload,
  client: GitHubClient,
  env: Env,
): Promise<Response> {
  const pr = payload.pull_request;
  const review = payload.review;
  if (!pr || !review) return jsonResponse({ success: true, status: 'no review payload' });
  if (payload.action !== 'submitted' || review.state !== 'approved') {
    return jsonResponse({ success: true, action: payload.action ?? '', status: 'ignored' });
  }

  const baseRef = pr.base?.ref ?? '';
  const expected = expectedBaseBranch(env);
  if (baseRef !== expected) {
    return jsonResponse({ success: true, status: 'skipped', reason: `base ${baseRef} ≠ ${expected}` });
  }

  const owner = pr.base?.repo?.owner?.login ?? '';
  const repo = pr.base?.repo?.name ?? '';
  if (!owner || !repo) {
    return jsonResponse({ success: false, error: 'missing repo in payload' }, 400);
  }
  const prCtx = await buildPRContext(client, owner, repo, pr.number);
  const sections = await resolveOutputSectionsForPR(client, prCtx, env);
  const result = await runConfirmAndWriteToBody(client, prCtx, sections);
  return jsonResponse({ success: result.ok, action: 'logWrite', error: result.error });
}

// ============================================================================
// 入口
// ============================================================================

async function verifySignature(
  secret: string,
  signature: string,
  body: string,
): Promise<boolean> {
  if (!signature.startsWith('sha256=')) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hex = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `sha256=${hex}` === signature;
  } catch (err) {
    console.error('[verifySignature] failed:', err);
    return false;
  }
}

async function acquireGitHubClient(
  env: Env,
  payload: { installation?: { id?: number } },
): Promise<GitHubClient | null> {
  try {
    return await createGitHubClient(env, payload.installation?.id);
  } catch (err) {
    console.error('[acquireGitHubClient] failed:', err);
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    const body = await request.text();
    const eventType = request.headers.get('X-GitHub-Event') ?? '';
    const signature = request.headers.get('X-Hub-Signature-256') ?? '';
    const deliveryId = request.headers.get('X-GitHub-Delivery') ?? '';
    console.log(`[webhook] ${eventType} delivery=${deliveryId}`);

    if (env.GITHUB_WEBHOOK_SECRET) {
      const ok = await verifySignature(env.GITHUB_WEBHOOK_SECRET, signature, body);
      if (!ok) return jsonResponse({ success: false, error: 'Invalid signature' }, 401);
    }

    let payload: PullRequestPayload & RepositoryDispatchPayload;
    try {
      payload = JSON.parse(body) as PullRequestPayload & RepositoryDispatchPayload;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON' }, 400);
    }

    const client = await acquireGitHubClient(env, payload);
    if (!client) {
      return jsonResponse({ success: false, error: 'Unable to authenticate' }, 401);
    }

    try {
      switch (eventType) {
        case 'pull_request':
          return await handlePullRequest(payload, client, env);
        case 'pull_request_review':
          return await handlePullRequestReview(payload, client, env);
        case 'repository_dispatch':
          return await handleRepositoryDispatch(payload, client, env);
        case 'ping':
          return jsonResponse({ success: true, status: 'pong' });
        default:
          return jsonResponse({ success: true, event: eventType, status: 'ignored' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[webhook] handler error:', msg);
      return jsonResponse({ success: false, error: msg }, 500);
    }
  },
};
