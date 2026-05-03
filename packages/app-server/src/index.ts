/**
 * release-toolkit GitHub App - Cloudflare Worker
 *
 * 最小实现：接收 GitHub Webhook 事件，调用 @release-toolkit/core 功能
 */

interface Env {
  GITHUB_APP_ID: string;
  GITHUB_APP_PRIVATE_KEY: string;
  GITHUB_WEBHOOK_SECRET: string;
}

interface WebhookEvent {
  action?: string;
  pull_request?: {
    number: number;
    title: string;
    body: string | null;
    base: { ref: string; repo: { owner: { login: string }; name: string } };
    head: { ref: string };
  };
  repository?: {
    owner: { login: string };
    name: string;
    full_name: string;
  };
  installation?: {
    id: number;
  };
  ref?: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    const eventType = request.headers.get('X-GitHub-Event');
    const signature = request.headers.get('X-Hub-Signature-256');

    if (!eventType || !signature) {
      return new Response('Missing required headers', { status: 400 });
    }

    const body = await request.text();

    // 验证签名
    const isValid = await verifySignature(body, signature, env.GITHUB_WEBHOOK_SECRET);
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }

    const event: WebhookEvent = JSON.parse(body);

    try {
      const result = await handleEvent(eventType, event, env);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};

async function verifySignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const expected = 'sha256=' + hex(sigBytes);
  return safeEqual(expected, signature);
}

function hex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function safeEqual(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  return crypto.subtle.timingSafeEqual(aBytes, bBytes);
}

async function handleEvent(
  eventType: string,
  event: WebhookEvent,
  env: Env,
): Promise<Record<string, unknown>> {
  // pull_request 事件
  if (eventType === 'pull_request') {
    const pr = event.pull_request;
    if (!pr || !event.installation) {
      return { success: false, message: 'Missing PR or installation data' };
    }

    // 第一次创建 PR：评论提醒批准后才自动生成
    if (event.action === 'opened') {
      const token = await getInstallationToken(event.installation.id, env);
      await commentOnPR(token, pr.number, pr.base.repo.owner.login, pr.base.repo.name);
      return { success: true, message: `PR #${pr.number} - reminded user to approve` };
    }

    // PR 更新（synchronize/edited/ready_for_review）：触发 collect
    const supported = ['synchronize', 'edited', 'ready_for_review'];
    if (!supported.includes(event.action ?? '')) {
      return { success: true, message: `Skipped action: ${event.action}` };
    }

    const token = await getInstallationToken(event.installation.id, env);
    await triggerWorkflow(
      token,
      pr.base.repo.owner.login,
      pr.base.repo.name,
      'collect.yml',
      { pr_number: pr.number },
    );

    return {
      success: true,
      message: `PR #${pr.number} - triggered collect workflow`,
    };
  }

  // push 事件：触发 releasePreview
  if (eventType === 'push') {
    const repo = event.repository;
    if (!repo) {
      return { success: false, message: 'Missing repository data' };
    }

    // 获取 installation token
    // 注意：push 事件没有 installation 对象，需要从 JWT 获取
    const token = await getInstallationTokenFromRepo(repo.full_name, env);

    await triggerWorkflow(
      token,
      repo.owner.login,
      repo.name,
      'preview.yml',
      {},
    );

    return { success: true, message: 'Push event - triggered preview workflow' };
  }

  return { success: true, message: `Unhandled event: ${eventType}` };
}

/** 在 PR 创建时评论提醒用户批准 */
async function commentOnPR(
  token: string,
  prNumber: number,
  owner: string,
  repo: string,
): Promise<void> {
  const commentBody = [
    '👋 感谢创建 PR！',
    '',
    '⚠️ **提醒：** 本仓库已安装 `release-toolkit` App，',
    '只有当 PR **被批准（approved）后**，才会自动：',
    '1. 收集变更日志',
    '2. 更新 PR 描述体',
    '3. 保存变更快照',
    '',
    '➡️ **下一步：** 请找 Maintainer 批准此 PR 即可自动生成！',
  ].join('\n');

  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-API-Version': '2022-11-28',
        'User-Agent': 'release-toolkit-app',
      },
      body: JSON.stringify({ body: commentBody }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to comment: ${response.status} ${text}`);
  }
}

/** 触发 GitHub Actions workflow */
async function triggerWorkflow(
  token: string,
  owner: string,
  repo: string,
  workflow: string,
  inputs: Record<string, string | number>,
): Promise<void> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'release-toolkit-app',
      },
      body: JSON.stringify({
        ref: 'main', // 或动态获取默认分支
        inputs,
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to trigger ${workflow}: ${response.status} ${text}`);
  }
}

/** 获取 installation token（从 push 事件） */
async function getInstallationTokenFromRepo(
  fullName: string,
  env: Env,
): Promise<string> {
  const jwt = await generateJWT(parseInt(env.GITHUB_APP_ID), env.GITHUB_APP_PRIVATE_KEY);

  // 获取 installation ID
  const response = await fetch(
    `https://api.github.com/repos/${fullName}/installation`,
    {
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to get installation: ${response.status}`);
  }

  const data = await response.json() as { id: number };
  return getInstallationToken(data.id, env);
}

/** 获取 installation access token */
async function getInstallationToken(
  installationId: number,
  env: Env,
): Promise<string> {
  const jwt = await generateJWT(parseInt(env.GITHUB_APP_ID), env.GITHUB_APP_PRIVATE_KEY);

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'release-toolkit-app',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to get installation token: ${response.status}`);
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

/** 生成 GitHub App JWT */
async function generateJWT(appId: number, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now - 60,
    exp: now + 600,
    iss: appId,
  };

  const header = { alg: 'RS256', typ: 'JWT' };
  const encodedHeader = base64urlEncode(JSON.stringify(header));
  const encodedPayload = base64urlEncode(JSON.stringify(payload));

  const key = await importPrivateKey(privateKey);
  const signatureBytes = await crypto.subtle.sign(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );
  const encodedSignature = base64urlEncode(
    String.fromCharCode(...new Uint8Array(signatureBytes)),
  );

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

/** 导入 PEM 私钥 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace('-----BEGIN RSA PRIVATE KEY-----', '')
    .replace('-----END RSA PRIVATE KEY-----', '')
    .replace(/\s/g, '');

  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'pkcs8',
    bytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/** Base64 URL 编码 */
function base64urlEncode(str: string): string {
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
