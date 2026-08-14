import { loadConfig, resolveGitTagName } from '../../shared/config/index.js';
import { resolveWorkspacePackages } from '../../shared/workspace.js';
import { detectVersionChanges } from '../../shared/version.js';
import { createTagsForDiffs } from './tag-manager.js';
import { createGithubRelease } from './github-release.js';
import { runPublisherHooks } from './hook-runner.js';
import { loadPluginsAsIPlugin } from '../../shared/plugins/index.js';
import { HookRunner } from '../../shared/hook-runner.js';
import type { ReleasePublisherOptions, ReleasePublisherResult, ReleaseHookContext } from './types.js';

export async function publishRelease(
  options: ReleasePublisherOptions,
): Promise<ReleasePublisherResult> {
  const cwd = options.cwd || process.cwd();
  const config = loadConfig({
    cwd,
    configPath: options.configPath,
  });
  const gitTags = config.releasePublisher?.gitTags;
  const errors: string[] = [];
  const releases: Array<{ packageName: string; tagName: string; releaseUrl?: string }> = [];

  const hookRunner = new HookRunner([]);

  try {
    const { plugins: iPlugins, errors: pluginErrors } = await loadPluginsAsIPlugin(config.plugins);
    if (pluginErrors.length > 0) {
      for (const e of pluginErrors) console.warn(`[publish] ${e}`);
    }
    hookRunner.setPlugins(iPlugins);

    // 1. beforePublish 钩子
    await hookRunner.runBeforePublish({
      packageName: '',
      oldVersion: '',
      newVersion: '',
      tagName: '',
    });

    // 2. 检测版本变更
    const workspacePatterns = await resolveWorkspacePackages(
      config.releasePreview.workspaceFile,
      { cwd },
    );
    const diffs = await detectVersionChanges(
      options.branch ?? config.branches.base,
      'HEAD',
      workspacePatterns.length > 0 ? workspacePatterns : ['packages/*'],
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
          tagName: resolveGitTagName(
            gitTags,
            diff.package.packageName,
            diff.package.newVersion,
          ),
        };

        // beforeTag 钩子
        if (config.releasePublisher?.beforeTag?.length) {
          const { errors: hookErrors } = await runPublisherHooks(
            'beforeTag',
            config.releasePublisher.beforeTag,
            hookContext,
            cwd,
          );
          errors.push(...hookErrors);
        }
      }

      const tagResults = await createTagsForDiffs(diffs, cwd, gitTags);
      for (const result of tagResults) {
        if (!result.success && result.error) {
          errors.push(`Tag ${result.tagName} 创建失败：${result.error}`);
        }
      }
    }

    // 4. 创建 GitHub Releases
    if (config.releasePublisher?.createGithubRelease !== false && !options.dryRun) {
      for (const diff of diffs) {
        const tagName = resolveGitTagName(
          gitTags,
          diff.package.packageName,
          diff.package.newVersion,
        );
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
          tagName: resolveGitTagName(
            gitTags,
            diff.package.packageName,
            diff.package.newVersion,
          ),
        };
        const { errors: hookErrors } = await runPublisherHooks(
          'afterRelease',
          config.releasePublisher.afterRelease,
          hookContext,
          cwd,
        );
        errors.push(...hookErrors);
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
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`发布流程失败：${msg}`);
    return { success: false, releases, errors };
  }
}
