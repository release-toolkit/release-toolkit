import { describe, it, expect } from 'vitest';
import {
  toBulletLines,
  formatTitleBullet,
  formatChangeLogBullets,
} from '../features/pr-log-collector/package-log-format.js';

describe('toBulletLines', () => {
  it('should prefix lines that do not start with -', () => {
    expect(toBulletLines('新增登录\n修复 bug')).toEqual([
      '- 新增登录',
      '- 修复 bug',
    ]);
  });

  it('should not add extra prefix when line already starts with -', () => {
    expect(toBulletLines('- 已有列表项\n普通行')).toEqual([
      '- 已有列表项',
      '- 普通行',
    ]);
  });
});

describe('formatTitleBullet', () => {
  it('should append （标题） suffix', () => {
    expect(formatTitleBullet('feat: 新增登录功能', [])).toBe(
      '- feat: 新增登录功能（标题）',
    );
  });
});

describe('formatChangeLogBullets', () => {
  it('should return placeholder when empty', () => {
    expect(formatChangeLogBullets('', [])).toEqual(['- （无对应的变更日志）']);
  });

  it('should format conventional changelog lines via plugins', () => {
    const bullets = formatChangeLogBullets('- feat: 新增登录\n- fix: 修复', []);
    expect(bullets).toEqual(['- feat: 新增登录', '- fix: 修复']);
  });
});
