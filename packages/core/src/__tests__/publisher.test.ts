import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishRelease } from '../features/release-publisher/publisher.js';
import { detectVersionChanges } from '../shared/version.js';
import { createTagsForDiffs } from '../features/release-publisher/tag-manager.js';
import { createGithubRelease } from '../features/release-publisher/github-release.js';

// Mock all dependencies（保留 resolveGitTagName 等真实实现）
vi.mock('../shared/config/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../shared/config/index.js')>();
  return {
    ...actual,
    loadConfig: vi.fn(() => ({
      branches: { base: 'main' },
      releasePreview: {
        workspaceFile: 'pnpm-workspace.yaml',
        noChangeMessage: '⚠️ 无版本变更',
      },
      releasePublisher: { createGithubRelease: true },
      prLogCollector: {},
      plugins: [],
    })),
  };
});

vi.mock('../shared/workspace.js', () => ({
  resolveWorkspacePackages: vi.fn(() => Promise.resolve(['packages/*'])),
}));

vi.mock('../shared/version.js', () => ({
  detectVersionChanges: vi.fn(),
  compareVersions: vi.fn(),
  resolvePackageDirs: vi.fn(),
}));

vi.mock('../features/release-publisher/tag-manager.js', () => ({
  createTagsForDiffs: vi.fn(() => []),
}));

vi.mock('../features/release-publisher/github-release.js', () => ({
  createGithubRelease: vi.fn(() => Promise.resolve('https://github.com/test/repo/releases/tag/test@1.0.0')),
}));

vi.mock('../features/release-publisher/hook-runner.js', () => ({
  runPublisherHooks: vi.fn(() =>
    Promise.resolve({ allSuccess: true, results: [], errors: [] }),
  ),
  runHooks: vi.fn(() => Promise.resolve([])),
  runHooksAndCheck: vi.fn(() => Promise.resolve({ allSuccess: true, results: [] })),
}));

describe('publishRelease', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return success with empty releases when no version changes', async () => {
    vi.mocked(detectVersionChanges).mockResolvedValue([]);

    const result = await publishRelease({});

    expect(result.success).toBe(true);
    expect(result.releases).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });

  it('should create releases for version changes', async () => {
    vi.mocked(detectVersionChanges).mockResolvedValue([
      {
        package: {
          packageName: 'test-package',
          packagePath: '/project/packages/test-package',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        },
        diffType: 'minor',
      },
    ]);

    const result = await publishRelease({ dryRun: false });

    expect(result.success).toBe(true);
    expect(result.releases.length).toBeGreaterThan(0);
  });

  it('should skip git tags creation in dryRun mode', async () => {
    vi.mocked(detectVersionChanges).mockResolvedValue([
      {
        package: {
          packageName: 'test-package',
          packagePath: '/project/packages/test-package',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        },
        diffType: 'minor',
      },
    ]);

    await publishRelease({ dryRun: true });

    expect(vi.mocked(createTagsForDiffs)).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(detectVersionChanges).mockRejectedValue(new Error('Git error'));

    const result = await publishRelease({});

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should use options.owner and options.repo when provided', async () => {
    vi.mocked(detectVersionChanges).mockResolvedValue([
      {
        package: {
          packageName: 'test-package',
          packagePath: '/project/packages/test-package',
          currentVersion: '1.0.0',
          newVersion: '1.1.0',
        },
        diffType: 'minor',
      },
    ]);

    await publishRelease({
      owner: 'my-org',
      repo: 'my-repo',
      dryRun: false,
    });

    expect(vi.mocked(createGithubRelease)).toHaveBeenCalled();
  });

  it('should use options.branch to override config.branches.base', async () => {
    vi.mocked(detectVersionChanges).mockResolvedValue([]);

    await publishRelease({ branch: 'feature-x' });

    // 第一个参数为目标分支（base），应优先取 options.branch
    expect(vi.mocked(detectVersionChanges).mock.calls[0][0]).toBe('feature-x');
  });

  it('should fall back to config.branches.base when branch option is absent', async () => {
    vi.mocked(detectVersionChanges).mockResolvedValue([]);

    await publishRelease({});

    // mock loadConfig 返回 branches.base = 'main'
    expect(vi.mocked(detectVersionChanges).mock.calls[0][0]).toBe('main');
  });
});
