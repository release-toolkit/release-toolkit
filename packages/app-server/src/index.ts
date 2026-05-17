import { App } from 'octokit';

const WELCOME_MSG = `👋 你好！我是 Release Toolkit Bot。

我已收到你的 PR 提交，正在处理中...`;

const MERGED_MSG = `✅ PR 已合并！

感谢你的贡献。`;

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
}

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

      // 手动解析 JSON
      const payload = JSON.parse(body);
      const { owner, repo } = payload.repository;

      // 从 installation payload 获取 installation_id
      const installationId = payload.installation?.id;
      if (!installationId) {
        console.error('No installation_id in payload');
        return new Response(JSON.stringify({ success: false, error: 'No installation_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      // 获取 installation 对应的 octokit 实例
      const app = new App({
        appId: Number(env.GITHUB_APP_ID),
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
      });
      const octokit = await app.getInstallationOctokit(installationId);

      console.log('Repo info:', { owner: owner.login, repo, issue_number: payload.pull_request.number });

      // opened + reopened：发欢迎评论
      if (eventType === 'pull_request' && (payload.action === 'opened' || payload.action === 'reopened')) {
        console.log('PR opened/reopened, sending welcome comment');
        await octokit.rest.issues.createComment({
          owner: owner.login,
          repo,
          issue_number: payload.pull_request.number,
          body: WELCOME_MSG,
        });
        console.log('Welcome comment sent');
      }

      // merged：发合并评论
      if (eventType === 'pull_request' && payload.action === 'closed' && payload.pull_request.merged) {
        console.log('PR merged, sending merged comment');
        await octokit.rest.issues.createComment({
          owner: owner.login,
          repo,
          issue_number: payload.pull_request.number,
          body: MERGED_MSG,
        });
        console.log('Merged comment sent');
      }

      // synchronize + ready_for_review：记录日志
      if (eventType === 'pull_request' && (payload.action === 'synchronize' || payload.action === 'ready_for_review')) {
        console.log('PR synchronized/ready_for_review');
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
