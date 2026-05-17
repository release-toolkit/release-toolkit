/**
 * release-toolkit GitHub App - Cloudflare Worker
 *
 * 使用 octokit App 类处理：JWT 签名、Webhook 验证、API 调用
 * 环境变量：GITHUB_APP_ID, GITHUB_WEBHOOK_SECRET, GITHUB_APP_PRIVATE_KEY
 */

import { App } from 'octokit';

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // 环境变量检查
    if (!env.GITHUB_APP_ID || !env.GITHUB_WEBHOOK_SECRET || !env.GITHUB_APP_PRIVATE_KEY) {
      console.error('Missing required env vars:', {
        hasAppId: !!env.GITHUB_APP_ID,
        hasWebhookSecret: !!env.GITHUB_WEBHOOK_SECRET,
        hasPrivateKey: !!env.GITHUB_APP_PRIVATE_KEY,
      });
      return new Response('Server misconfigured', { status: 500 });
    }

    const app = new App({
      appId: Number(env.GITHUB_APP_ID),
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
      webhooks: {
        secret: env.GITHUB_WEBHOOK_SECRET,
      },
    });

    // 注册 PR 事件处理器
    app.webhooks.on('pull_request.opened', async ({ octokit, payload }) => {
      const { owner, name: repo } = payload.repository;
      await octokit.rest.issues.createComment({
        owner: owner.login,
        repo,
        issue_number: payload.pull_request.number,
        body: 'Release Toolkit 已就绪 🎉\n\n当你准备好发布时，请将 PR 设为 "Ready for review"。',
      });
      console.log(`Welcome comment posted on ${owner.login}/${repo}#${payload.pull_request.number}`);
    });

    app.webhooks.on('pull_request.reopened', async ({ octokit, payload }) => {
      const { owner, name: repo } = payload.repository;
      await octokit.rest.issues.createComment({
        owner: owner.login,
        repo,
        issue_number: payload.pull_request.number,
        body: 'Release Toolkit 已就绪 🎉\n\n当你准备好发布时，请将 PR 设为 "Ready for review"。',
      });
      console.log(`Welcome comment posted on ${owner.login}/${repo}#${payload.pull_request.number}`);
    });

    app.webhooks.on('pull_request.closed', async ({ octokit, payload }) => {
      if (!payload.pull_request.merged) return;
      const { owner, name: repo } = payload.repository;
      await octokit.rest.issues.createComment({
        owner: owner.login,
        repo,
        issue_number: payload.pull_request.number,
        body: 'PR 已合并，Release Toolkit 正在准备发布预览...',
      });
      console.log(`Merge comment posted on ${owner.login}/${repo}#${payload.pull_request.number}`);
    });

    app.webhooks.on('pull_request.synchronize', async ({ octokit, payload }) => {
      const { owner, name: repo } = payload.repository;
      await octokit.rest.actions.createWorkflowDispatch({
        owner: owner.login,
        repo,
        workflow_id: 'pr-log-collector.yml',
        ref: payload.pull_request.head.ref,
        inputs: { pr_number: String(payload.pull_request.number) },
      });
      console.log(`Workflow triggered for ${owner.login}/${repo}#${payload.pull_request.number}`);
    });

    app.webhooks.on('pull_request.ready_for_review', async ({ octokit, payload }) => {
      const { owner, name: repo } = payload.repository;
      await octokit.rest.actions.createWorkflowDispatch({
        owner: owner.login,
        repo,
        workflow_id: 'pr-log-collector.yml',
        ref: payload.pull_request.head.ref,
        inputs: { pr_number: String(payload.pull_request.number) },
      });
      console.log(`Workflow triggered for ${owner.login}/${repo}#${payload.pull_request.number}`);
    });

    app.webhooks.onError((error) => {
      console.error('Webhook handler error:', error.message);
    });

    // 处理请求
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const body = await request.text();
    const eventType = request.headers.get('X-GitHub-Event') ?? '';
    const signature = request.headers.get('X-Hub-Signature-256') ?? request.headers.get('X-Hub-Signature') ?? '';

    if (!eventType || !signature) {
      return new Response('Missing headers', { status: 400 });
    }

    try {
      await app.webhooks.verifyAndReceive({
        id: request.headers.get('X-GitHub-Delivery') ?? '',
        name: eventType as any,
        payload: JSON.parse(body),
        signature,
      });

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // 签名验证失败返回 401，其他错误返回 500
      const status = msg.includes('signature') ? 401 : 500;
      if (status === 500) console.error('Error processing webhook:', msg);
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
