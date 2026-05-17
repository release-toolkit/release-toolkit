/**
 * release-toolkit GitHub App - Cloudflare Worker
 *
 * 通用 GitHub App 服务端，处理 PR 事件：
 * - opened/reopened: 发送评论提醒用户
 * - synchronize/edited/ready_for_review: 触发 GitHub Actions workflow
 *
 * 环境变量：
 * - GITHUB_APP_ID: GitHub App ID
 * - GITHUB_WEBHOOK_SECRET: Webhook 签名密钥
 * - GITHUB_APP_PRIVATE_KEY: GitHub App PEM 私钥
 */

// ============================================================================
// 类型定义
// ============================================================================

interface WebhookEvent {
  action?: string;
  pull_request?: {
    number: number;
    title?: string;
    body?: string | null;
    merged?: boolean;
    head?: { ref?: string };
    base?: {
      ref?: string;
      repo?: {
        owner?: { login?: string };
        name?: string;
      };
    };
  };
  installation?: {
    id: number;
  };
}

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 常量时间字符串比较（防时序攻击）
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * ArrayBuffer 转 hex 字符串
 */
function hex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let result = '';
  for (const byte of bytes) {
    result += ('0' + byte.toString(16)).slice(-2);
  }
  return result;
}

/**
 * Base64 URL 编码
 */
function base64urlEncode(data: ArrayBufferLike): string {
  // 使用 TextEncoder 将 ArrayBuffer 转为 base64，然后处理
  const binaryString = Array.from(new Uint8Array(data))
    .map((byte) => String.fromCharCode(byte))
    .join('');
  
  // 使用 btoa 进行 base64 编码
  const base64 = btoa(binaryString);
  
  // 转换为 base64url 并移除填充
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * 验证请求签名 (HMAC-SHA256)
 */
async function verifySignature(
  payload: unknown,
  signature: string | undefined,
  secret: string
): Promise<boolean> {
  if (!signature) return false;

  // 移除 "sha256=" 前缀
  const signatureValue = signature.replace(/^sha256=/, '');

  // 使用 Web Crypto API 计算 HMAC
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const payloadStr = JSON.stringify(payload);
  const payloadBuffer = new TextEncoder().encode(payloadStr);
  
  // 计算签名
  const signedData = await crypto.subtle.sign('HMAC', key, payloadBuffer);
  const signedHex = hex(signedData);
  
  // 将签名字符串转换为 ArrayBuffer 计算其 hex
  const signatureBytes = new Uint8Array(signatureValue.length / 2);
  for (let i = 0; i < signatureValue.length; i += 2) {
    signatureBytes[i / 2] = parseInt(signatureValue.slice(i, i + 2), 16);
  }
  const expectedHex = hex(signatureBytes.buffer);

  return safeEqual(signedHex, expectedHex);
}

// ============================================================================
// JWT 生成 (RS256)
// ============================================================================

/**
 * 解析 PEM 私钥格式，提取 DER 格式
 */
function parsePrivateKeyPem(pem: string): ArrayBuffer {
  // 移除 PEM 头尾
  const lines = pem.split('\n');
  const body = lines.filter((line) => !line.startsWith('-----')).join('');
  
  // Base64 解码
  const binaryString = Array.from(body).map((c) => c.charCodeAt(0)).map((c) => String.fromCharCode(c)).join('');
  const bytes = Uint8Array.from(atob(binaryString), (c) => c.charCodeAt(0));
  
  return bytes.buffer;
}

/**
 * 导入 PEM 私钥为 CryptoKey
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = parsePrivateKeyPem(pem);
  return crypto.subtle.importKey('pkcs8', keyData, { name: 'RSA-SHA256' }, true, ['sign']);
}

/**
 * 生成 GitHub App JWT (RS256)
 */
async function generateJWT(appId: number, privateKey: CryptoKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: String(appId),
    exp: now + 600, // 10 分钟过期
  };

  const joseHeader = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const headerJson = JSON.stringify(joseHeader);
  const payloadJson = JSON.stringify(payload);

  const headerBuffer = new TextEncoder().encode(headerJson);
  const payloadBuffer = new TextEncoder().encode(payloadJson);

  const base64Header = base64urlEncode(headerBuffer.buffer);
  const base64Payload = base64urlEncode(payloadBuffer.buffer);

  const input = `${base64Header}.${base64Payload}`;
  const inputBuffer = new TextEncoder().encode(input);

  const signature = await crypto.subtle.sign('RSA-SHA256', privateKey, inputBuffer);
  const signatureBase64 = base64urlEncode(signature);

  return `${base64Header}.${base64Payload}.${signatureBase64}`;
}

// ============================================================================
// GitHub API 调用
// ============================================================================

/**
 * 获取 Installation Access Token
 */
async function getInstallationToken(
  jwt: string,
  installationId: number
): Promise<string> {
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get installation token: ${response.status} - ${errorText}`);
  }

  const data = (await response.json()) as { token: string };
  return data.token;
}

/**
 * 在 PR 上添加评论
 */
async function commentOnPR(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<void> {
  await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body }),
  });
}

/**
 * 触发 GitHub Actions workflow
 */
async function triggerWorkflow(
  token: string,
  owner: string,
  repo: string,
  prNumber: number,
  ref?: string
): Promise<void> {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/pr-log-collector.yml/dispatches`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref: ref || 'refs/heads/main',
      inputs: {
        pr_number: String(prNumber),
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Failed to trigger workflow:', response.status, errorText);
    throw new Error(`Failed to trigger workflow: ${response.status}`);
  }
}

// ============================================================================
// 事件处理
// ============================================================================

/**
 * 处理 PR 事件
 */
async function handlePREvent(event: WebhookEvent, env: Env): Promise<void> {
  const { pull_request, installation } = event;

  if (!pull_request) {
    throw new Error('Missing pull_request in event');
  }

  const { number: prNumber, merged } = pull_request;
  const installationId = installation?.id;

  if (!installationId) {
    throw new Error('Missing installation.id in event');
  }

  console.log('Handling PR event:', { prNumber, merged, action: event.action, installationId });

  // 获取 token
  const privateKey = await importPrivateKey(env.GITHUB_APP_PRIVATE_KEY!);
  const jwt = await generateJWT(Number(env.GITHUB_APP_ID), privateKey);
  const token = await getInstallationToken(jwt, installationId);

  // 获取仓库信息
  const repo = pull_request.base?.repo;
  if (!repo?.owner?.login || !repo.name) {
    throw new Error('Cannot determine repository from PR base.repo');
  }

  const owner = repo.owner.login;
  const repoName = repo.name;

  if (merged) {
    // 已合并：发送合并确认评论
    await commentOnPR(token, owner, repoName, prNumber, 'PR 已合并，Release Toolkit 正在准备发布预览...');
  } else {
    // 根据 action 类型处理
    switch (event.action) {
      case 'opened':
      case 'reopened':
        // 发送欢迎评论
        await commentOnPR(
          token,
          owner,
          repoName,
          prNumber,
          'Release Toolkit 已就绪 🎉\n\n感谢使用 release-toolkit，为你的 PR 提供自动化发布支持。\n\n当你准备好发布时，请将 PR 设为 "Ready for review"。'
        );
        break;

      case 'synchronize':
      case 'edited':
      case 'ready_for_review':
        // 触发 pr-log-collector.yml workflow
        const ref = pull_request.head?.ref;
        await triggerWorkflow(token, owner, repoName, prNumber, ref);
        console.log('Triggered pr-log-collector workflow for PR:', prNumber);
        break;

      default:
        // 其他 action 不处理
        break;
    }
  }
}

/**
 * 处理安装事件
 */
async function handleInstallationEvent(event: WebhookEvent, _env: Env): Promise<void> {
  const { installation } = event;

  if (!installation) {
    throw new Error('Missing installation in event');
  }

  console.log('App installed with installationId:', installation.id);
}

/**
 * 核心事件处理器
 */
async function handleEvent(event: WebhookEvent, env: Env): Promise<void> {
  const { action } = event;

  switch (action) {
    case 'opened':
    case 'reopened':
    case 'closed':
    case 'synchronize':
    case 'edited':
    case 'ready_for_review':
      await handlePREvent(event, env);
      break;

    case 'installed':
      await handleInstallationEvent(event, env);
      break;

    default:
      console.log('Ignoring event action:', action);
      break;
  }
}

// ============================================================================
// 入口
// ============================================================================

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
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

    if (eventType !== 'pull_request') {
      console.log('Ignoring non-PR event:', eventType);
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const secret = env.GITHUB_WEBHOOK_SECRET || '';
    const body = await request.text();
    const parsedBody = JSON.parse(body) as WebhookEvent;

    // 验证签名
    const isValid = await verifySignature(parsedBody, signature, secret);
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }

    try {
      console.log('Received webhook event:', parsedBody.action);

      await handleEvent(parsedBody, env);

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error handling event:', errorMessage);

      return new Response(JSON.stringify({ success: false, error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
