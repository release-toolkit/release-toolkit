import { describe, it, expect } from 'vitest';
import {
  applyEmojiPrefixToLine,
  toBulletLines,
  formatTitleBulletWithEmoji,
  formatChangeLogBulletsPlain,
  parseReleaseLog,
  extractReleaseLogFromBody,
  RELEASE_LOG_START,
  RELEASE_LOG_END,
} from '../index.js';

describe('applyEmojiPrefixToLine', () => {
  it('应为 feat/fix 添加 emoji', () => {
    expect(applyEmojiPrefixToLine('- feat: 新增登录')).toBe('- ✨ feat: 新增登录');
    expect(applyEmojiPrefixToLine('- fix(auth): 修复登录')).toBe('- 🐛 fix(auth): 修复登录');
  });

  it('未知类型或已有 emoji 时不改动', () => {
    expect(applyEmojiPrefixToLine('- unknown: x')).toBe('- unknown: x');
    expect(applyEmojiPrefixToLine('- ✨ feat: 新功能')).toBe('- ✨ feat: 新功能');
  });
});

describe('toBulletLines', () => {
  it('应为非列表行添加 - 前缀', () => {
    expect(toBulletLines('行一\n行二')).toEqual(['- 行一', '- 行二']);
    expect(toBulletLines('- 已有\n普通')).toEqual(['- 已有', '- 普通']);
  });
});

describe('formatTitleBulletWithEmoji', () => {
  it('应附加（标题）并加 emoji', () => {
    expect(formatTitleBulletWithEmoji('feat: 新增登录')).toBe('- ✨ feat: 新增登录（标题）');
  });
});

describe('formatChangeLogBulletsPlain', () => {
  it('空内容返回占位', () => {
    expect(formatChangeLogBulletsPlain('')).toEqual(['- （无对应的变更日志）']);
  });

  it('应对每行加 emoji', () => {
    expect(formatChangeLogBulletsPlain('feat: A\nfix: B')).toEqual([
      '- ✨ feat: A',
      '- 🐛 fix: B',
    ]);
  });
});

describe('parseReleaseLog', () => {
  it('应解析 ## 包名分组', () => {
    const result = parseReleaseLog('## package-a\n- feat: A\n- fix: B');
    expect(result).toHaveLength(1);
    expect(result[0].packages).toEqual(['package-a']);
  });

  it('无 ## 时为通用日志', () => {
    const result = parseReleaseLog('- 通用 1\n- 通用 2');
    expect(result[0].packages).toEqual([]);
  });
});

describe('extractReleaseLogFromBody', () => {
  it('应截取标记区', () => {
    const body = `前文\n${RELEASE_LOG_START}\n## a\n- x\n${RELEASE_LOG_END}\n后文`;
    const { rawReleaseLog, packageChangeLogs } = extractReleaseLogFromBody(body);
    expect(rawReleaseLog).toContain('## a');
    expect(packageChangeLogs[0].packages).toEqual(['a']);
  });
});
