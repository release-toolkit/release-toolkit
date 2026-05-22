import { loadConfig } from '../../shared/config/index.js';
import { scanWorkspace } from '../../shared/workspace.js';
import { detectVersionChanges } from '../../shared/version.js';
import { createTagsForDiffs } from './tag-manager.js';
import { createGithubRelease } from './github-release.js';
import { runHooks } from './hook-runner.js';
import { loadPluginsAsIPlugin } from '../../shared/plugins/index.js';
import { HookRunner } from '../../shared/hook-runner.js';
import type { ReleasePublisherOptions, ReleasePublisherResult, ReleaseHookContext } from './types.js';

export async function publishRelease(
  options: ReleasePublisherOptions,
): Promise<ReleasePublisherResult> {
  const cwd = options.cwd || process.cwd();
  const config = loadConfig(cwd);
  const errors: string[] = [];
  const releases: Array<{ packageName: string; tagName: string; releaseUrl?: string }> = [];

  const hookRunner = new HookRunner([]);
  const { plugins: iPlugins } = await loadPluginsAsIPlugin(config.plugins);
  hookRunner.setPlugins(iPlugins);

  // 1. beforePublish 钩子
  await hookRunner.runBeforePublish({
    packageName: '',
    oldVersion: '',
    newVersion: '',
    tagName: '',
  });

  // 2. 检测版本变更
  const workspaceInfo = scanWorkspace(config.releasePreview.workspaceFile, cwd);
  const diffs = await detectVersionChanges(
    config.branches.base,
    'HEAD',
    workspaceInfo.packages,
    cwd,
  );

  if (diffs.length === 0) {
    return { success: true, releases: [], errors: [] };
  }

  // 3. 创建 Git tags（带 beforeTag 钩子）
  if (!options.dryRun) {
    for (const diff of diffs) {
      const hookContext: ReleaseHookContext = {
        packageName: diff.package.packageName,
        oldVersion: diff.package.currentVersion,
        newVersion: diff.package.newVersion,
        tagName: `${diff.package.packageName}@${diff.package.newVersion}`,
      };

      // beforeTag 钩子
      if (config.releasePublisher?.beforeTag?.length) {
        await runHooks(config.releasePublisher.beforeTag, hookContext, cwd);
      }
    }

    const tagResults = await createTagsForDiffs(diffs, cwd);
    for (const result of tagResults) {
      if (!result.success && result.error) {
        errors.push(`Tag ${result.tagName} 创建失败：${result.error}`);
      }
    }
  }

  // 4. 创建 GitHub Releases
  if (config.releasePublisher?.createGithubRelease !== false && !options.dryRun) {
    for (const diff of diffs) {
      const tagName = `${diff.package.packageName}@${diff.package.newVersion}`;
      const hookContext: ReleaseHookContext = {
        packageName: diff.package.packageName,
        oldVersion: diff.package.currentVersion,
        newVersion: diff.package.newVersion,
        tagName,
      };

      try {
        const owner = options.owner || process.env.GITHUB_REPOSITORY?.split('/')[0] || '';
        const repo = options.repo || process.env.GITHUB_REPOSITORY?.split('/')[1] || '';
        const token = options.token || process.env.GITHUB_TOKEN;

        const url = await createGithubRelease(
          hookContext,
          owner,
          repo,
          token,
        );
        releases.push({ packageName: diff.package.packageName, tagName, releaseUrl: url ?? undefined });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Release ${tagName} 创建失败：${msg}`);
      }
    }
  }

  // 5. afterRelease 钩子（配置文件）
  if (config.releasePublisher?.afterRelease?.length) {
    for (const diff of diffs) {
      const hookContext: ReleaseHookContext = {
        packageName: diff.package.packageName,
        oldVersion: diff.package.currentVersion,
        newVersion: diff.package.newVersion,
        tagName: `${diff.package.packageName}@${diff.package.newVersion}`,
      };
      await runHooks(config.releasePublisher.afterRelease, hookContext, cwd);
    }
  }

  // 6. afterPublish 钩子（插件）
  const publishResult: ReleasePublisherResult = {
    success: errors.length === 0,
    releases,
    errors,
  };

  await hookRunner.runAfterPublish({
    packageName: '',
    oldVersion: '',
    newVersion: '',
    tagName: '',
  }, publishResult);

  return publishResult;
}
