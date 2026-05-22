import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runHook } from '../features/release-publisher/hook-runner.js';

const context = {
  packageName: 'pkg-a',
  oldVersion: '1.0.0',
  newVersion: '1.1.0',
  tagName: 'pkg-a@1.1.0',
};

describe('runHook notification types', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('webhook 应 POST 到配置的 url', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => 'ok',
    });

    const result = await runHook(
      {
        type: 'webhook',
        url: 'https://example.com/hook',
        body: '{"tag":"{{tagName}}"}',
      },
      context,
    );

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({
        method: 'POST',
        body: '{"tag":"pkg-a@1.1.0"}',
      }),
    );
  });

  it('slack 缺少 webhookUrl 时应失败', async () => {
    const result = await runHook({ type: 'slack', message: 'hi' }, context);
    expect(result.success).toBe(false);
    expect(result.error).toContain('webhookUrl');
  });

  it('discord 应发送 content 字段', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      text: async () => '',
    });

    const result = await runHook(
      {
        type: 'discord',
        webhookUrl: 'https://discord.com/api/webhooks/x',
        discordMessage: 'Release {{tagName}}',
      },
      context,
    );

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://discord.com/api/webhooks/x',
      expect.objectContaining({
        body: JSON.stringify({ content: 'Release pkg-a@1.1.0' }),
      }),
    );
  });
});
