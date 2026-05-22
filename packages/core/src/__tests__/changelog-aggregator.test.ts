import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { aggregateReleaseLogs } from '../shared/changelog-aggregator.js';

describe('aggregateReleaseLogs', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = mkdtempSync(join(tmpdir(), 'release-toolkit-'));
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('should return placeholder when snapshot dir is missing', () => {
    const result = aggregateReleaseLogs(cwd);
    expect(result).toContain('暂无 PR 日志快照');
  });

  it('should return placeholder when snapshot dir has no valid files', () => {
    const dir = resolve(cwd, '.release-toolkit', 'changelog', 'prs');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'README.md'), 'noise');
    const result = aggregateReleaseLogs(cwd);
    expect(result).toContain('暂无有效 PR 日志');
  });

  it('should aggregate snapshots ordered by prNumber and keep new bullet format', () => {
    const dir = resolve(cwd, '.release-toolkit', 'changelog', 'prs');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'pr-2.json'),
      JSON.stringify({
        prNumber: 2,
        title: 'fix: 修复登录',
        releaseLog: '## package-a\n- fix: 修复登录（标题）\n- 修复定时器',
        savedAt: '2026-05-22T00:00:00Z',
      }),
    );
    writeFileSync(
      join(dir, 'pr-1.json'),
      JSON.stringify({
        prNumber: 1,
        title: 'feat: 新增登录',
        releaseLog: '## package-a\n- feat: 新增登录（标题）\n- 新增微信登录',
        savedAt: '2026-05-21T00:00:00Z',
      }),
    );

    const result = aggregateReleaseLogs(cwd);
    const idx1 = result.indexOf('### PR #1: feat: 新增登录');
    const idx2 = result.indexOf('### PR #2: fix: 修复登录');
    expect(idx1).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeGreaterThan(idx1);
    expect(result).toContain('- feat: 新增登录（标题）');
    expect(result).toContain('- fix: 修复登录（标题）');
  });

  it('should skip malformed snapshot files without throwing', () => {
    const dir = resolve(cwd, '.release-toolkit', 'changelog', 'prs');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'pr-broken.json'), '{not valid json');
    writeFileSync(
      join(dir, 'pr-3.json'),
      JSON.stringify({ prNumber: 3, title: 'docs', releaseLog: null, savedAt: '' }),
    );
    const result = aggregateReleaseLogs(cwd);
    expect(result).toContain('### PR #3: docs');
  });
});
