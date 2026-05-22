import { describe, it, expect } from 'vitest';
import {
  applyGitTagTemplate,
  resolveGitTagMessage,
  resolveGitTagName,
} from '../shared/config/git-tag-format.js';

describe('git-tag-format', () => {
  it('应替换 packageName 与 version 占位符', () => {
    expect(
      applyGitTagTemplate('{packageName}@{version}', '@my/pkg', '1.2.3'),
    ).toBe('@my/pkg@1.2.3');
  });

  it('resolveGitTagName 使用配置格式', () => {
    expect(
      resolveGitTagName(
        { format: 'v{version}-{packageName}', message: 'x' },
        'core',
        '2.0.0',
      ),
    ).toBe('v2.0.0-core');
  });

  it('resolveGitTagMessage 无配置时使用默认模板', () => {
    expect(resolveGitTagMessage(undefined, 'pkg-a', '1.0.0')).toBe(
      'Release pkg-a@1.0.0',
    );
  });
});
