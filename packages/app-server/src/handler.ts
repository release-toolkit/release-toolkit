import type { WebhookEvent } from './types.js';
import { generateJWT } from './jwt.js';
import {
  createGitHubClient,
  commentOnPR,
  triggerWorkflow,
  getPRTitle,
  getPRBody,
} from './github.js';
import type { Octokit } from 'octokit';

/**
 * 处理 Webhook 事件的上下文
 */
export interface HandlerContext {
  appId: number;
  privateKeyPem: string;
  secret: string;
  workflowId: string;
  owner: string;
  repo: string;
}

/**
 * 处理 PR 事件
 */
export async function handlePREvent(
  event: WebhookEvent,
  context: HandlerContext
): Promise<void> {
  const { pull_request } = event;

  if (!pull_request) {
    throw new Error('Missing pull_request in event');
  }

  const { number: prNumber, merged, base } = pull_request;
  const { owner, repo } = context;

  console.log('Handling PR event:', { prNumber, merged, action: event.action });

  // 创建 GitHub 客户端（使用安装的 token）
  const octokit = await createAuthenticatedClient(context);

  if (merged) {
    // 处理已合并的 PR：触发 release-preview workflow
    // 获取 PR 信息
    const title = await getPRTitle(octokit, owner, repo, prNumber);
    const body = await getPRBody(octokit, owner, repo, prNumber);

    // 触发 release-preview workflow
    await triggerWorkflow(octokit, owner, repo, context.workflowId, base.ref, {
      prNumber,
      title,
      body,
      mergedAt: new Date().toISOString(),
    });

    // 添加评论确认
    await commentOnPR(
      octokit,
      owner,
      repo,
      prNumber,
      'Release preview workflow triggered successfully.'
    );
  } else {
    // 处理未合并的 PR：发送欢迎评论
    await commentOnPR(
      octokit,
      owner,
      repo,
      prNumber,
      'Release Toolkit 已就绪 🎉\n\n感谢使用 release-toolkit，为你的 PR 提供自动化发布支持。'
    );
  }
}

/**
 * 处理安装事件
 */
export async function handleInstallationEvent(
  event: WebhookEvent,
  _context: HandlerContext
): Promise<void> {
  const { installation } = event;

  if (!installation) {
    throw new Error('Missing installation in event');
  }

  const { id: _installationId } = installation; // eslint-disable-line @typescript-eslint/no-unused-vars
  // 更新 installationId（如果需要持久化）
  // 这里可以扩展为更新配置或数据库
}

/**
 * 创建已认证的 GitHub 客户端
 */
async function createAuthenticatedClient(context: HandlerContext): Promise<Octokit> {
  const { appId, privateKeyPem } = context;

  // 生成 JWT
  await generateJWT(appId, privateKeyPem);

  // 获取 installation token
  // 注意：这里需要知道 installationId，可能需要从配置或数据库中获取
  // 当前简化实现，直接使用 token 模式
  const octokit = createGitHubClient({ token: '' }); // 需要扩展

  return octokit;
}

/**
 * 根据事件类型分发处理
 */
export async function dispatchEvent(
  event: WebhookEvent,
  context: HandlerContext
): Promise<void> {
  const { action } = event;

  switch (action) {
    case 'opened':
    case 'reopened':
    case 'closed':
      await handlePREvent(event, context);
      break;
    case 'installed':
      await handleInstallationEvent(event, context);
      break;
    default:
      // 忽略其他事件类型
      break;
  }
}

