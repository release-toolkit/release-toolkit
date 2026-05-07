import { loadConfig } from '../../shared/config/index.js';
import { postOrUpdateComment } from '../../shared/github/pr-commenter.js';
import { scanWorkspace } from './workspace-scanner.js';
import { detectVersionChanges } from './version-detector.js';
import { aggregateLogs } from './log-aggregator.js';
import { formatReleasePreviewComment } from './formatter.js';
import { loadPlugins } from '../../shared/plugins/index.js';
import type { ReleasePreviewOptions, ReleasePreviewResult } from './types.js';

export async function previewRelease(
  options: ReleasePreviewOptions,
): Promise<ReleasePreviewResult> {
  const context = {
    isGitHubActions: true,
    eventName: 'pull_request',
    prNumber: options.prNumber,
    repoOwner: options.owner,
    repoName: options.repo,
    token: options.token,
  };

  try {
    const config = loadConfig(options.cwd);
    const workspaceInfo = scanWorkspace(options.cwd);
    const versionDiffs = await detectVersionChanges(
      config.productionBranch || 'main',
      'HEAD',
      workspaceInfo.packages,
      options.cwd,
    );

    const hasVersionChange = versionDiffs.length > 0;
    const aggregatedLog = hasVersionChange ? aggregateLogs(options.cwd) : '';
    const noChangeMessage =
      config.releasePreview?.noChangeMessage ??
      '⚠️ 本次 PR 未检测到任何包的版本变更，合并后将不会触发发布。';

    // 加载插件
    const { formatters } = await loadPlugins(config.plugins);

    const commentBody = formatReleasePreviewComment(
      hasVersionChange,
      versionDiffs,
      aggregatedLog,
      noChangeMessage,
      formatters,
    );

    await postOrUpdateComment(context, commentBody);

    return {
      success: true,
      prNumber: options.prNumber,
      hasVersionChange,
      versionDiffs,
      commentPosted: true,
    };
  } catch (err) {
    return {
      success: false,
      prNumber: options.prNumber,
      hasVersionChange: false,
      versionDiffs: [],
      commentPosted: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
