import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  compareVersions,
  resolvePackageDirs,
  detectVersionChanges,
} from '../shared/version.js';


// Mock git-reader module
vi.mock('../shared/git/git-reader.js', () => ({
  diffFiles: vi.fn(),
  showFileContent: vi.fn(),
}));

describe('compareVersions', () => {
  it('should detect major version change', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe('major');
    expect(compareVersions('0.1.0', '1.0.0')).toBe('major');
  });

  it('should detect minor version change', () => {
    expect(compareVersions('1.0.0', '1.1.0')).toBe('minor');
    expect(compareVersions('2.5.0', '2.6.0')).toBe('minor');
  });

  it('should detect patch version change', () => {
    expect(compareVersions('1.0.0', '1.0.1')).toBe('patch');
    expect(compareVersions('2.5.3', '2.5.4')).toBe('patch');
  });

  it('should return null for same version', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBeNull();
  });

  it('should handle pre-release versions', () => {
    expect(compareVersions('1.0.0', '1.0.1-alpha.1')).toBe('patch');
  });
});

describe('resolvePackageDirs', () => {
  it('should resolve glob patterns with /*', () => {
    const result = resolvePackageDirs(['packages/*'], '/project');
    expect(result).toContain('/project/packages');
  });

  it('should resolve direct paths', () => {
    const result = resolvePackageDirs(['packages/core'], '/project');
    expect(result).toContain('/project/packages/core');
  });

  it('should handle multiple patterns', () => {
    const result = resolvePackageDirs(['packages/*', 'libs/*'], '/project');
    expect(result.length).toBe(2);
  });
});

describe('detectVersionChanges', () => {
  let mockDiffFiles: ReturnType<typeof vi.fn>;
  let mockShowFileContent: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const gitReader = await import('../shared/git/git-reader.js');
    mockDiffFiles = vi.mocked(gitReader.diffFiles);
    mockShowFileContent = vi.mocked(gitReader.showFileContent);
  });

  it('should detect version changes for a sub-package under packages/*', async () => {
    mockDiffFiles.mockResolvedValue(['packages/core/package.json']);
    mockShowFileContent
      .mockResolvedValueOnce('{"name":"core","version":"1.0.0"}')
      .mockResolvedValueOnce('{"name":"core","version":"1.1.0"}');

    const result = await detectVersionChanges('main', 'HEAD', ['packages/*'], '/project');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      package: {
        packageName: 'core',
        packagePath: 'packages/core',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
      },
      diffType: 'minor',
    });
  });

  it('should detect multiple changed sub-packages under packages/*', async () => {
    mockDiffFiles.mockResolvedValue([
      'packages/core/package.json',
      'packages/ui/package.json',
    ]);
    mockShowFileContent
      .mockResolvedValueOnce('{"name":"core","version":"1.0.0"}')
      .mockResolvedValueOnce('{"name":"core","version":"1.1.0"}')
      .mockResolvedValueOnce('{"name":"ui","version":"2.0.0"}')
      .mockResolvedValueOnce('{"name":"ui","version":"2.1.0"}');

    const result = await detectVersionChanges('main', 'HEAD', ['packages/*'], '/project');

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.package.packageName).sort()).toEqual(['core', 'ui']);
  });

  it('should ignore packages outside the workspace glob', async () => {
    mockDiffFiles.mockResolvedValue([
      'apps/web/package.json',
      'packages/core/package.json',
    ]);
    mockShowFileContent
      .mockResolvedValueOnce('{"name":"core","version":"1.0.0"}')
      .mockResolvedValueOnce('{"name":"core","version":"1.1.0"}');

    const result = await detectVersionChanges('main', 'HEAD', ['packages/*'], '/project');

    expect(result).toHaveLength(1);
    expect(result[0].package.packageName).toBe('core');
  });

  it('should return empty array when no package.json changes', async () => {
    mockDiffFiles.mockResolvedValue(['README.md']);

    const result = await detectVersionChanges('main', 'HEAD', ['packages/*'], '/project');

    expect(result).toHaveLength(0);
  });

  it('should skip packages where file content cannot be read', async () => {
    mockDiffFiles.mockResolvedValue(['packages/core/package.json']);
    mockShowFileContent
      .mockRejectedValueOnce(new Error('File not found'))
      .mockResolvedValueOnce('{"name":"core","version":"1.1.0"}');

    const result = await detectVersionChanges('main', 'HEAD', ['packages/*'], '/project');

    expect(result).toHaveLength(0);
  });

  it('should skip packages with unchanged version', async () => {
    mockDiffFiles.mockResolvedValue(['packages/ui/package.json']);
    mockShowFileContent
      .mockResolvedValueOnce('{"name":"ui","version":"2.0.0"}')
      .mockResolvedValueOnce('{"name":"ui","version":"2.0.0"}');

    const result = await detectVersionChanges('main', 'HEAD', ['packages/*'], '/project');

    expect(result).toHaveLength(0);
  });
});
