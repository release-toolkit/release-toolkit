import { App } from 'octokit';

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
}

const WELCOME_MSG = 'Release Toolkit 已就绪 🎉\n\n当你准备好发布时，请将 PR 设为 "Ready for review"。';
const MERGED_MSG = 'PR 已合并，Release Toolkit 正在准备发布预览...';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
    if (!env.GITHUB_APP_ID || !env.GITHUB_APP_PRIVATE_KEY) {
      return new Response('Server misconfigured', { status: 500 });
    }

    try {
      const body = await request.text();
      const eventType = request.headers.get('X-GitHub-Event') ?? '';
      const deliveryId = request.headers.get('X-GitHub-Delivery') ?? '';

      console.log('Received webhook:', eventType, 'deliveryId:', deliveryId);

      const app = new App({
        appId: Number(env.GITHUB_APP_ID),
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
      });

      // 手动解析 JSON，因为不使用 verifyAndReceive
      const payload = JSON.parse(body);

      // opened + reopened：发欢迎评论
      if (eventType === 'pull_request' && (payload.action === 'opened' || payload.action === 'reopened')) {
        console.log('PR opened/reopened, sending welcome comment');
        const { owner, repo } = payload.repository;
        await app.octokit.rest.issues.createComment({
          owner, repo, issue_number: payload.pull_request.number, body: WELCOME_MSG,
        });
      }

      // merged：发合并评论
      if (eventType === 'pull_request' && payload.action === 'closed' && payload.pull_request.merged) {
        console.log('PR merged, sending merged comment');
        const { owner, repo } = payload.repository;
        await app.octokit.rest.issues.createComment({
          owner, repo, issue_number: payload.pull_request.number, body: MERGED_MSG,
        });
      }

      // synchronize + ready_for_review：触发 workflow
      if (eventType === 'pull_request' && (payload.action === 'synchronize' || payload.action === 'ready_for_review')) {
        console.log('PR synchronized/ready_for_review, triggering workflow');
        const { owner, repo } = payload.repository;
        await app.octokit.rest.actions.createWorkflowDispatch({
          owner, repo,
          workflow_id: 'pr-log-collector.yml',
          ref: payload.pull_request.head.ref,
          inputs: { pr_number: String(payload.pull_request.number) },
        });
      }

      console.log('Webhook processed successfully');
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Webhook error:', msg);
      console.error('Error stack:', e instanceof Error ? e.stack : 'no stack');
      return new Response(JSON.stringify({ success: false, error: msg }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  },
};
