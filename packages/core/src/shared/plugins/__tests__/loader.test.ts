import { describe, it, expect } from 'vitest';
import { applyFormatters } from '../loader.js';

describe('plugins loader', () => {
  it('should be able to import plugins module', async () => {
    const module = await import('../loader.js');
    expect(module).toBeDefined();
    expect(module.loadPlugins).toBeDefined();
    expect(typeof module.loadPlugins).toBe('function');
    expect(module.applyFormatters).toBeDefined();
    expect(typeof module.applyFormatters).toBe('function');
  });

  it('should apply formatters to changelog entries', () => {
    const entries = [
      { type: 'feat', scope: 'auth', subject: 'add login' },
      { type: 'fix', subject: 'correct typo' },
    ];

    // 无插件时，返回默认格式
    const result = applyFormatters(entries, []);
    expect(result).toContain('add login');
    expect(result).toContain('correct typo');
  });

  it('should handle empty entries', () => {
    const result = applyFormatters([], []);
    expect(result).toBe('');
  });
});
