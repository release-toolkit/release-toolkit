import { describe, it, expect } from 'vitest';
import { formatHookFailureMessages } from '../features/release-publisher/hook-runner.js';

describe('formatHookFailureMessages', () => {
  it('应格式化失败的钩子信息', () => {
    const messages = formatHookFailureMessages(
      'beforeTag',
      { packageName: 'pkg-a', oldVersion: '1.0.0', newVersion: '1.1.0', tagName: 'pkg-a@1.1.0' },
      [
        { hook: 'command', result: { success: true } },
        { hook: 'webhook', result: { success: false, error: 'HTTP 500' } },
      ],
    );
    expect(messages).toEqual(['[beforeTag] pkg-a / webhook：HTTP 500']);
  });
});
