/**
 * release-toolkit GitHub App - Cloudflare Worker
 *
 * 接收 GitHub Webhook 事件，调用 @release-toolkit/core 功能
 */

import { verifySignature } from './verify.ts';
import { dispatchEvent } from './handler.ts';
import type { HandlerContext } from './handler.ts';
// 为将来集成准备，暂时禁用未使用警告
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { previewRelease } from '@release-toolkit/core';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { publishRelease } from '@release-toolkit/core';

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_WORKFLOW_ID?: string;
  GITHUB_OWNER?: string;
  GITHUB_REPO?: string;
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
    const secret = env.GITHUB_WEBHOOK_SECRET || '';
    const parsedBody = JSON.parse(body);
    if (!verifySignature(parsedBody, signature, secret)) {
      return new Response('Invalid signature', { status: 401 });
    }

    try {
      const event = parsedBody as Parameters<typeof dispatchEvent>[0];

      // 调试日志
      console.log('Received webhook event:', event.action);

      // 构建处理上下文
      const context: HandlerContext = {
        appId: Number(env.GITHUB_APP_ID) || 0,
        privateKeyPem: env.GITHUB_APP_PRIVATE_KEY || '',
        secret,
        workflowId: env.GITHUB_WORKFLOW_ID || '',
        owner: env.GITHUB_OWNER || '',
        repo: env.GITHUB_REPO || '',
      };

      console.log('Context:', { appId: context.appId, owner: context.owner, repo: context.repo, workflowId: context.workflowId });

      await dispatchEvent(event, context);

      console.log('Event dispatched successfully');

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({ success: false, error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
