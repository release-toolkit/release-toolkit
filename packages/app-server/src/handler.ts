import type { WebhookEvent } from './types.ts';
import { generateJWT } from './jwt.ts';
import {
  createAuthenticatedClientWithInstallation,
  commentOnPR,
} from './github.ts';
import type { Octokit } from 'octokit';

/**
 * 处理 Webhook 事件的上下文
 */
export interface HandlerContext {
  appId: number;
  privateKeyPem: string;
  secret: string;
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
  const { pull_request, installation } = event;

  if (!pull_request) {
    throw new Error('Missing pull_request in event');
  }

  const { number: prNumber, merged } = pull_request;
  const { owner, repo } = context;
  const installationId = installation?.id;

  if (!installationId) {
    throw new Error('Missing installation.id in event');
  }

  console.log('Handling PR event:', { prNumber, merged, action: event.action, installationId });

  // 创建 GitHub 客户端（使用安装的 token）
  const octokit = await createAuthenticatedClient(context, installationId);

  if (merged) {
    // 处理已合并的 PR：发送合并确认评论
    await commentOnPR(
      octokit,
      owner,
      repo,
      prNumber,
      'PR 已合并，Release Toolkit 正在准备发布预览...'
    );
  } else {
    // 处理未合并的 PR：发送欢迎评论
    await commentOnPR(
      octikit,
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

  const { id: installationId } = installation;
  console.log('App installed with installationId:', installationId);
}

/**
 * 创建已认证的 GitHub 客户端
 */
async function createAuthenticatedClient(
  context: HandlerContext,
  installationId: number
): Promise<Octokit> {
  const { appId, privateKeyPem } = context;

  // 生成 JWT
  const jwt = await generateJWT(appId, privateKeyPem);

  // 使用 JWT + installationId 获取 access token
  return createAuthenticatedClientWithInstallation(jwt, installationId);
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
