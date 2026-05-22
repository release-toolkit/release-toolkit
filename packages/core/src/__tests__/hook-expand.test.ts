import { describe, it, expect } from 'vitest';
import { expandPublisherHooks } from '../features/release-publisher/hook-expand.js';

describe('expandPublisherHooks', () => {
  it('LifecycleHook 应展开为 run + webhook + slack', () => {
    const expanded = expandPublisherHooks([
      {
        run: { type: 'command', command: 'pnpm build' },
        webhook: { url: 'https://example.com/hook' },
        notify: { type: 'slack', webhookUrl: 'https://hooks.slack.com/x', message: 'ok' },
      },
    ]);

    expect(expanded).toHaveLength(3);
    expect(expanded[0]).toMatchObject({ type: 'command', command: 'pnpm build' });
    expect(expanded[1]).toMatchObject({ type: 'webhook', url: 'https://example.com/hook' });
    expect(expanded[2]).toMatchObject({ type: 'slack', webhookUrl: 'https://hooks.slack.com/x' });
  });

  it('扁平 AfterReleaseHook 应保持不变', () => {
    const expanded = expandPublisherHooks([
      { type: 'discord', webhookUrl: 'https://discord.com/api/webhooks/1' },
    ]);
    expect(expanded).toHaveLength(1);
    expect(expanded[0].type).toBe('discord');
  });

  it('扁平钩子附带 notify 时应先执行主钩子再通知', () => {
    const expanded = expandPublisherHooks([
      {
        type: 'command',
        command: 'echo hi',
        notify: { type: 'discord', webhookUrl: 'https://discord.com/x', message: 'done' },
      },
    ]);
    expect(expanded).toHaveLength(2);
    expect(expanded[0].type).toBe('command');
    expect(expanded[1].type).toBe('discord');
  });
});
