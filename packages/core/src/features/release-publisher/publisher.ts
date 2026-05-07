import { loadConfig } from '../../shared/config/index.js';
import { detectVersionChanges } from '../release-preview/version-detector.js';
import { scanWorkspace } from '../release-preview/workspace-scanner.js';
import { createTagsForDiffs } from './tag-manager.js';
import { createGithubRelease } from './github-release.js';
import { runAfterReleaseHooks } from './hook-runner.js';
import type { ReleasePublisherOptions, ReleasePublisherResult, ReleaseHookContext } from './types.js';

export async function publishRelease(
  options: ReleasePublisherOptions,
): Promise<ReleasePublisherResult> {
  const cwd = options.cwd || process.cwd();
  const config = loadConfig(cwd);
  const errors: string[] = [];
  const releases: Array<{ packageName: string; tagName: string; releaseUrl?: string }> = [];

  try {
    // 1. 检测版本变更
    const workspaceInfo = scanWorkspace(cwd);
    const diffs = await detectVersionChanges(
      config.productionBranch || 'main',
      'HEAD',
      workspaceInfo.packages,
      cwd,
    );

    if (diffs.length === 0) {
      return { success: true, releases: [], errors: [] };
    }

    // 2. 创建 Git tags
    if (!options.dryRun) {
      const tagResults = await createTagsForDiffs(diffs, cwd);
      for (const result of tagResults) {
        if (!result.success && result.error) {
          errors.push(`Tag ${result.tagName} 创建失败：${result.error}`);
        }
      }
    }

    // 3. 创建 GitHub Releases
    if (config.releasePublisher?.createGithubRelease !== false && !options.dryRun) {
      for (const diff of diffs) {
        const tagName = `${diff.packageName}@${diff.newVersion}`;
        const hookContext: ReleaseHookContext = {
          packageName: diff.packageName,
          oldVersion: diff.oldVersion,
          newVersion: diff.newVersion,
          tagName,
        };

        try {
          // 优先使用 options 参数，环境变量作为 fallback
          const owner = options.owner || process.env.GITHUB_REPOSITORY?.split('/')[0] || '';
          const repo = options.repo || process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
          const token = options.token || process.env.GITHUB_TOKEN;

          const url = await createGithubRelease(
            hookContext,
            owner,
            repo,
            token,
          );
          releases.push({ packageName: diff.packageName, tagName, releaseUrl: url ?? undefined });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Release ${tagName} 创建失败：${msg}`);
        }
      }
    }

    // 4. 执行 afterRelease 钩子
    if (config.releasePublisher?.afterRelease && config.releasePublisher.afterRelease.length > 0) {
      for (const diff of diffs) {
        const hookContext: ReleaseHookContext = {
          packageName: diff.packageName,
          oldVersion: diff.oldVersion,
          newVersion: diff.newVersion,
          tagName: `${diff.packageName}@${diff.newVersion}`,
        };
        runAfterReleaseHooks(config.releasePublisher.afterRelease, hookContext, cwd);
      }
    }

    return {
      success: errors.length === 0,
      releases,
      errors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      releases,
      errors: [...errors, msg],
    };
  }
}
