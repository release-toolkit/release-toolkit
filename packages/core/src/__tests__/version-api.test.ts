import { describe, it, expect } from 'vitest';
import { matchesWorkspaceFilePath } from '../shared/version-api.js';

describe('matchesWorkspaceFilePath', () => {
  it('应匹配 packages/* 下的 package.json', () => {
    expect(matchesWorkspaceFilePath('packages/core/package.json', ['packages/*'])).toBe(
      true,
    );
    expect(matchesWorkspaceFilePath('apps/web/package.json', ['packages/*'])).toBe(false);
  });

  it('workspace 配置文件路径时接受任意 package.json', () => {
    expect(
      matchesWorkspaceFilePath('libs/foo/package.json', ['pnpm-workspace.yaml']),
    ).toBe(true);
  });
});
