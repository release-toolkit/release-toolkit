import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadPlugins, applyFormatters } from '../shared/plugins/loader.js';
import type { ChangelogFormatter } from '../shared/plugins/types.js';

describe('loadPlugins', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load built-in plugins by name', async () => {
    const result = await loadPlugins(['emoji-prefix']);

    expect(result.errors).toHaveLength(0);
    expect(result.formatters).toHaveLength(1);
    expect(typeof result.formatters[0].formatLine).toBe('function');
  });

  it('should load multiple built-in plugins', async () => {
    const result = await loadPlugins(['emoji-prefix', 'markdown-bold']);

    expect(result.errors).toHaveLength(0);
    expect(result.formatters).toHaveLength(2);
  });

  it('should return errors for non-existent plugins', async () => {
    const result = await loadPlugins(['non-existent-plugin']);

    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.formatters).toHaveLength(0);
  });

  it('should handle mixed valid and invalid plugins', async () => {
    const result = await loadPlugins(['emoji-prefix', 'non-existent']);

    expect(result.formatters).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  it('should load default plugins when no arguments provided', async () => {
    const result = await loadPlugins();

    expect(result.formatters.length).toBeGreaterThan(0);
  });
});

describe('applyFormatters', () => {
  const sampleEntries = [
    { type: 'feat', scope: 'core', subject: 'add new feature' },
    { type: 'fix', scope: 'ui', subject: 'fix button bug' },
  ];

  it('should return default format when no formatters provided', () => {
    const result = applyFormatters(sampleEntries, []);

    expect(result).toContain('**core**: add new feature');
    expect(result).toContain('**ui**: fix button bug');
  });

  it('should use format method when available', () => {
    const mockFormatter: ChangelogFormatter = {
      name: 'mock-format',
      format: (entries) =>
        entries.map((e) => `- [FORMATTED] ${e.subject}`).join('\n'),
    };

    const result = applyFormatters(sampleEntries, [mockFormatter]);

    expect(result).toContain('[FORMATTED] add new feature');
  });

  it('should use formatLine method when format is not available', () => {
    const mockFormatter: ChangelogFormatter = {
      name: 'mock-formatLine',
      formatLine: (line) => `✨ ${line}`,
    };

    const result = applyFormatters(sampleEntries, [mockFormatter]);

    expect(result).toContain('✨ - **core**: add new feature');
  });

  it('should apply multiple formatLine formatters in order', () => {
    const formatter1: ChangelogFormatter = {
      name: 'mock-formatter1',
      formatLine: (line) => `✨ ${line}`,
    };
    const formatter2: ChangelogFormatter = {
      name: 'mock-formatter2',
      formatLine: (line) => `**${line}**`,
    };

    const result = applyFormatters(sampleEntries, [formatter1, formatter2]);

    // Both formatters should be applied
    expect(result).toContain('✨');
  });

  it('should handle empty entries array', () => {
    const result = applyFormatters([], []);

    expect(result).toBe('');
  });
});
