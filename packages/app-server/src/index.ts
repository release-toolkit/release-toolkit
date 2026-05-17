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

      // 从 installation payload 获取 installation_id（GitHub 会发送 installation.id）
      const installationId = payload.installation?.id;
      if (!installationId) {
        console.error('No installation_id in payload');
        return new Response(JSON.stringify({ success: false, error: 'No installation_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      console.log('Repo info:', { owner: owner.login, repo, issue_number: payload.pull_request.number });

      // opened + reopened：记录日志
      if (eventType === 'pull_request' && (payload.action === 'opened' || payload.action === 'reopened')) {
        console.log('PR opened/reopened');
      }

      // merged：记录日志
      if (eventType === 'pull_request' && payload.action === 'closed' && payload.pull_request.merged) {
        console.log('PR merged');
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
