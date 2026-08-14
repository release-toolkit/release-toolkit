import { describe, it, expect } from 'vitest';
import { emojiPrefix } from '../formatters/emoji-prefix.js';
import { categoryGroup } from '../formatters/category-group.js';
import { markdownBold } from '../formatters/markdown-bold.js';
import { COMMIT_TYPE_EMOJI, COMMIT_TYPE_CATEGORY } from '../constants.js';

describe('emoji-prefix', () => {
  it('为常规 commit type 添加 emoji 前缀', () => {
    expect(emojiPrefix.formatLine('feat: 新增登录')).toBe('✨ feat: 新增登录');
    expect(emojiPrefix.formatLine('fix: 修复内存泄漏')).toBe('🐛 fix: 修复内存泄漏');
    expect(emojiPrefix.formatLine('docs: 更新文档')).toBe('📝 docs: 更新文档');
    expect(emojiPrefix.formatLine('refactor: 重构')).toBe('♻️ refactor: 重构');
    expect(emojiPrefix.formatLine('perf: 优化性能')).toBe('⚡️ perf: 优化性能');
  });

  it('支持带 scope 的 commit type', () => {
    expect(emojiPrefix.formatLine('feat(auth): 新增权限')).toBe('✨ feat(auth): 新增权限');
    expect(emojiPrefix.formatLine('fix(core): 修复 bug')).toBe('🐛 fix(core): 修复 bug');
  });

  it('未识别的 type 原样返回', () => {
    expect(emojiPrefix.formatLine('unknown: 无法识别')).toBe('unknown: 无法识别');
  });

  it('不带 type 前缀的行原样返回', () => {
    expect(emojiPrefix.formatLine('普通文本行')).toBe('普通文本行');
    expect(emojiPrefix.formatLine('- 已有列表项')).toBe('- 已有列表项');
  });
});

describe('category-group', () => {
  const entries = [
    { type: 'feat', subject: '新增登录' },
    { type: 'feat', subject: '新增注册' },
    { type: 'fix', subject: '修复崩溃', scope: 'core' },
    { type: 'unknown', subject: '其他变更' },
  ];

  it('按 commit type 分组并输出分类标题', () => {
    const output = categoryGroup.format!(entries);
    expect(output).toContain('### ✨ Features');
    expect(output).toContain('### 🐛 Bug Fixes');
    expect(output).toContain('### Other');
  });

  it('将条目放入对应分类下', () => {
    const output = categoryGroup.format!(entries);
    expect(output).toContain('- 新增登录');
    expect(output).toContain('- 新增注册');
  });

  it('带 scope 的条目渲染为粗体 scope', () => {
    const output = categoryGroup.format!(entries);
    expect(output).toContain('- **core**: 修复崩溃');
  });

  it('未识别的 type 归类为 Other', () => {
    const output = categoryGroup.format!(entries);
    expect(output).toContain('- 其他变更');
  });

  it('空列表输出为空字符串', () => {
    expect(categoryGroup.format!([])).toBe('');
  });
});

describe('markdown-bold', () => {
  it('将 scope 加粗', () => {
    expect(markdownBold.formatLine('feat(auth): 新增权限')).toBe('feat(**auth**): 新增权限');
    expect(markdownBold.formatLine('fix(core): 修复 bug')).toBe('fix(**core**): 修复 bug');
  });

  it('无 scope 时原样返回', () => {
    expect(markdownBold.formatLine('feat: 新增登录')).toBe('feat: 新增登录');
    expect(markdownBold.formatLine('普通文本')).toBe('普通文本');
  });
});

describe('constants', () => {
  it('COMMIT_TYPE_EMOJI 覆盖常用 commit type', () => {
    expect(COMMIT_TYPE_EMOJI.feat).toBe('✨');
    expect(COMMIT_TYPE_EMOJI.fix).toBe('🐛');
    expect(COMMIT_TYPE_EMOJI.docs).toBe('📝');
    expect(COMMIT_TYPE_EMOJI.refactor).toBe('♻️');
  });

  it('COMMIT_TYPE_CATEGORY 与 emoji 映射一致', () => {
    expect(COMMIT_TYPE_CATEGORY.feat.name).toBe('Features');
    expect(COMMIT_TYPE_CATEGORY.feat.emoji).toBe('✨');
    expect(COMMIT_TYPE_CATEGORY.fix.name).toBe('Bug Fixes');
    expect(COMMIT_TYPE_CATEGORY.fix.emoji).toBe('🐛');
  });
});
