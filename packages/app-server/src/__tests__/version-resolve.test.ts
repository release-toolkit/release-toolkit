import { describe, it, expect } from 'vitest';
import { packagePathToDirName, workspaceFileFromConfig } from '../version-resolve.js';

describe('version-resolve helpers', () => {
  it('workspaceFileFromConfig 应读取 releasePreview.workspaceFile', () => {
    expect(
      workspaceFileFromConfig({
        releasePreview: { workspaceFile: 'custom-workspace.yaml' },
      }),
    ).toBe('custom-workspace.yaml');
  });

  it('workspaceFileFromConfig 无配置时返回默认', () => {
    expect(workspaceFileFromConfig(null)).toBe('pnpm-workspace.yaml');
  });

  it('packagePathToDirName 应取路径末段', () => {
    expect(packagePathToDirName('packages/core')).toBe('core');
  });
});
