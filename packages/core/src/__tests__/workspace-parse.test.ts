import { describe, it, expect } from 'vitest';
import { parseWorkspacePackages } from '../shared/workspace-api.js';

describe('parseWorkspacePackages', () => {
  it('应解析 packages 列表', () => {
    const yaml = `
packages:
  - 'packages/*'
  - 'apps/*'
`;
    expect(parseWorkspacePackages(yaml)).toEqual(['packages/*', 'apps/*']);
  });

  it('空内容应返回空数组', () => {
    expect(parseWorkspacePackages('')).toEqual([]);
  });
});
