import { App } from 'octokit';
import { createHmac } from 'crypto';

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
}

const WELCOME_MSG = 'Release Toolkit 已就绪 🎉\n\n当你准备好发布时，请将 PR 设为 "Ready for review"。';
const MERGED_MSG = 'PR 已合并，Release Toolkit 正在准备发布预览...';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    if (!env.GITHUB_APP_ID || !env.GITHUB_WEBHOOK_SECRET || !env.GITHUB_APP_PRIVATE_KEY) {
      return new Response('Server misconfigured', { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get('X-Hub-Signature-256') ?? request.headers.get('X-Hub-Signature') ?? '';
    const eventType = request.headers.get('X-GitHub-Event') ?? '';
    const deliveryId = request.headers.get('X-GitHub-Delivery') ?? '';

    // DEBUG: 手动计算签名对比
    const secret = env.GITHUB_WEBHOOK_SECRET;
    const hmac = createHmac('sha256', Buffer.from(secret, 'utf8'));
    hmac.update(body);
    const expected = `sha256=${hmac.digest('hex')}`;
    console.error('DEBUG', {
      expected: expected,
      received: signature,
      match: expected === signature,
      body_len: body.length,
      event: eventType,
    });

    const app = new App({
      appId: Number(env.GITHUB_APP_ID),
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
      webhooks: { secret },
    });

    // opened + reopened：发欢迎评论
    app.webhooks.on(['pull_request.opened', 'pull_request.reopened'] as any, async ({ octokit, payload }) => {
      const { owner, name: repo } = payload.repository;
      await octokit.rest.issues.createComment({
        owner: owner.login, repo, issue_number: payload.pull_request.number, body: WELCOME_MSG,
      });
    });

    // merged：发合并评论
    app.webhooks.on('pull_request.closed', async ({ octokit, payload }) => {
      if (!payload.pull_request.merged) return;
      const { owner, name: repo } = payload.repository;
      await octokit.rest.issues.createComment({
        owner: owner.login, repo, issue_number: payload.pull_request.number, body: MERGED_MSG,
      });
    });

    // synchronize + ready_for_review：触发 workflow
    app.webhooks.on(['pull_request.synchronize', 'pull_request.ready_for_review'] as any, async ({ octokit, payload }) => {
      const { owner, name: repo } = payload.repository;
      await octokit.rest.actions.createWorkflowDispatch({
        owner: owner.login, repo,
        workflow_id: 'pr-log-collector.yml',
        ref: payload.pull_request.head.ref,
        inputs: { pr_number: String(payload.pull_request.number) },
      });
    });

    try {
      await app.webhooks.verifyAndReceive({
        id: deliveryId,
        name: eventType,
        payload: body,
        signature,
      });
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const status = msg.includes('signature') ? 401 : 500;
      console.error('Webhook error:', msg);
      return new Response(JSON.stringify({ success: false, error: msg }), { status, headers: { 'Content-Type': 'application/json' } });
    }
  },
};
