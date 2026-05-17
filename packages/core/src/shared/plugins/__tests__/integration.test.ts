import { describe, it, expect } from 'vitest';
import { loadPlugins, applyFormatters } from '../loader.js';
import type { ChangelogFormatter } from '../types.js';

describe('plugins integration', () => {
  it('should load built-in plugins', async () => {
    const { formatters, errors } = await loadPlugins(['emoji-prefix', 'category-group', 'markdown-bold']);

    expect(errors).toHaveLength(0);
    expect(formatters).toHaveLength(3);
    expect(formatters[0].name).toBe('emoji-prefix');
    expect(formatters[1].name).toBe('category-group');
    expect(formatters[2].name).toBe('markdown-bold');
  });

  it('should apply category-group formatter', () => {
    const entries = [
      { type: 'feat', scope: 'auth', subject: 'add login' },
      { type: 'fix', subject: 'correct typo' },
      { type: 'feat', scope: 'api', subject: 'add endpoint' },
    ];

    const formatters: ChangelogFormatter[] = [
      {
        name: 'category-group',
        format: (_entries) => {
          const lines: string[] = [];
          lines.push('### Features');
          lines.push('');
          lines.push('- **auth**: add login');
          lines.push('- **api**: add endpoint');
          lines.push('');
          lines.push('### Bug Fixes');
          lines.push('');
          lines.push('- correct typo');
          return lines.join('\n');
        },
      },
    ];

    const result = applyFormatters(entries, formatters);
    expect(result).toContain('### Features');
    expect(result).toContain('### Bug Fixes');
    expect(result).toContain('add login');
    expect(result).toContain('correct typo');
  });

  it('should apply emoji-prefix formatter', () => {
    const entries = [{ type: 'feat', subject: 'add feature' }];

    const formatters: ChangelogFormatter[] = [
      {
        name: 'emoji-prefix',
        formatLine: (line) => `✨ ${line}`,
      },
    ];

    const result = applyFormatters(entries, formatters);
    expect(result).toContain('✨');
    expect(result).toContain('add feature');
  });

  it('should apply markdown-bold formatter', () => {
    const entries = [{ type: 'feat', scope: 'auth', subject: 'add login' }];

    const formatters: ChangelogFormatter[] = [
      {
        name: 'markdown-bold',
        formatLine: (line) => line.replace(/^(\w+)\(([^)]+)\):/, '$1(**$2**):'),
      },
    ];

    const result = applyFormatters(entries, formatters);
    expect(result).toContain('**auth**');
  });

  it('should return default format when no formatters', () => {
    const entries = [
      { type: 'feat', scope: 'auth', subject: 'add login' },
      { type: 'fix', subject: 'correct typo' },
    ];

    const result = applyFormatters(entries, []);
    expect(result).toContain('**auth**: add login');
    expect(result).toContain('correct typo');
  });

  it('should handle empty entries', () => {
    const result = applyFormatters([], []);
    expect(result).toBe('');
  });
});
