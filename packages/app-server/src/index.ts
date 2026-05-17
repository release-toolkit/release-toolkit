/**
 * release-toolkit GitHub App - Cloudflare Worker
 *
 * 环境变量：GITHUB_APP_ID, GITHUB_WEBHOOK_SECRET, GITHUB_APP_PRIVATE_KEY
 */

import { Octokit } from '@octokit/rest';
import Webhooks from '@octokit/webhooks';

// ============================================================================
// 配置
// ============================================================================

// Cloudflare Workers 环境变量通过 env 参数传递
interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
}

// 使用 env 参数创建实例（在 fetch 中传入）
function createWebhooks(env: Env) {
  return new Webhooks({
    secret: env.GITHUB_WEBHOOK_SECRET || ''
  });
}

function createOctokit(env: Env) {
  return new Octokit({
    appId: Number(env.GITHUB_APP_ID),
    privateKey: env.GITHUB_APP_PRIVATE_KEY || ''
  });
}

// ============================================================================
// 事件处理
// ============================================================================

async function handlePREvent(
  event: {
    action: string;
    pull_request: {
      number: number;
      merged?: boolean;
      head?: { ref?: string };
      base?: { repo?: { owner?: { login?: string }; name?: string } };
    };
    installation: { id: number };
  },
  octokit: Octokit
): Promise<void> {
  const pr = event.pull_request;
  const installationId = event.installation.id;

  console.log(`Processing PR #${pr.number}, action: ${event.action}, installationId: ${installationId}`);

  // 获取 installation token
  await octokit.apps.createInstallationAccessToken({
    installation_id: installationId
  });

  const repo = pr.base?.repo;
  if (!repo?.owner?.login || !repo.name) {
    throw new Error('Cannot determine repository');
  }

  const owner = repo.owner.login;
  const repoName = repo.name;

  console.log(`Repository: ${owner}/${repoName}`);

  if (pr.merged) {
    // PR 已合并，评论提示
    await octokit.rest.issues.createComment({
      owner,
      repo: repoName,
      issue_number: pr.number,
      body: 'PR 已合并，Release Toolkit 正在准备发布预览...'
    });
  } else {
    switch (event.action) {
      case 'opened':
      case 'reopened':
        // PR 创建/重新打开，发送欢迎评论
        await octokit.rest.issues.createComment({
          owner,
          repo: repoName,
          issue_number: pr.number,
          body: 'Release Toolkit 已就绪 🎉\n\n当你准备好发布时，请将 PR 设为 "Ready for review"。'
        });
        break;

      case 'synchronize':
      case 'edited':
      case 'ready_for_review':
        // PR 更新/编辑/准备审查，触发 workflow
        await octokit.rest.actions.createWorkflowDispatch({
          owner,
          repo: repoName,
          workflow_id: 'pr-log-collector.yml',
          ref: pr.head?.ref || 'refs/heads/main',
          inputs: { pr_number: String(pr.number) }
        });
        break;
    }
  }
}

// ============================================================================
// 入口
// ============================================================================

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    console.log('Received request');

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const signature = request.headers.get('X-Hub-Signature-256') || request.headers.get('X-Hub-Signature');
    const event = request.headers.get('X-GitHub-Event');

    if (!signature || !event) {
      console.log('Missing headers:', { signature, event });
      return new Response('Missing headers', { status: 400 });
    }

    const rawBody = await request.arrayBuffer();
    const body = JSON.parse(new TextDecoder().decode(rawBody)) as Record<string, unknown>;

    console.log('GitHub Event:', event);

    // 创建实例（使用 env 参数）
    const webhooks = createWebhooks(env);
    const octokit = createOctokit(env);

    // 验证签名
    try {
      console.log('Verifying signature...');
      await webhooks.verify(rawBody, signature);
      console.log('Signature verified');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Signature verification failed:', msg);
      return new Response('Invalid signature', { status: 401 });
    }

    // 处理事件
    try {
      const payload = body as Record<string, unknown>;

      if (event === 'pull_request' && payload.pull_request) {
        console.log('Handling PR event');
        await handlePREvent({
          action: payload.action as string,
          pull_request: payload.pull_request as {
            number: number;
            merged?: boolean;
            head?: { ref?: string };
            base?: { repo?: { owner?: { login?: string }; name?: string } };
          },
          installation: payload.installation as { id: number }
        }, octokit);
      } else {
        console.log('Ignoring non-PR event or PR without installation');
      }

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Error processing event:', msg);
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
