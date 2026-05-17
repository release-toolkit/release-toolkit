import { App } from 'octokit';

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

    const app = new App({
      appId: Number(env.GITHUB_APP_ID),
      privateKey: env.GITHUB_APP_PRIVATE_KEY,
      webhooks: { secret: env.GITHUB_WEBHOOK_SECRET },
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
        id: request.headers.get('X-GitHub-Delivery') ?? '',
        name: request.headers.get('X-GitHub-Event') ?? '',
        payload: await request.text(),
        signature: request.headers.get('X-Hub-Signature-256') ?? request.headers.get('X-Hub-Signature') ?? '',
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
