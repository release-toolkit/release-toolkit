import { loadConfig } from '../../shared/config/index.js';
import { postOrUpdateComment } from '../../shared/github/pr-commenter.js';
import { getPullRequests } from '../../shared/github/api-client.js';
import { resolveWorkspacePackages } from '../../shared/workspace.js';
import { detectVersionChanges } from '../../shared/version.js';
import { aggregateReleaseLogs } from '../../shared/changelog-aggregator.js';
import { loadPluginsAsIPlugin } from '../../shared/plugins/index.js';
import { HookRunner } from '../../shared/hook-runner.js';
import { formatReleasePreviewComment } from './formatter.js';
import type { ReleasePreviewOptions, ReleasePreviewResult } from './types.js';
import type { VersionDiffResult } from '../../shared/types.js';
import { IS_WORKER, OUTPUT_MARKERS, escapeRegex } from '../../shared/utils.js';

/**
 * 通过 API 获取聚合的 Release Logs
 */
async function aggregateReleaseLogsByAPI(baseBranch: string): Promise<string> {
  const token = process.env.GITHUB_TOKEN || '';
  const owner = process.env.GITHUB_REPOSITORY?.split('/')[0] || '';
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';

  if (!token || !owner || !repo) {
    console.warn(
      '[preview] 缺少 GITHUB_TOKEN / GITHUB_REPOSITORY，跳过远程聚合 release logs',
    );
    return '';
  }

  try {
    // 获取已合并到目标分支的 PR 列表
    const prs = await getPullRequests(
      { token, owner, repo },
      { state: 'closed', base: baseBranch },
    );

    const mergedPrs = prs.filter((pr) => pr.merged === true);

    if (mergedPrs.length === 0) {
      return '';
    }

    // 获取每个 PR 的日志（从 PR body 中提取 RELEASE-TOOLKIT-OUTPUT 区域）
    const { START: OUTPUT_START, END: OUTPUT_END } = OUTPUT_MARKERS;

    const releaseLogs: string[] = [];

    for (const pr of mergedPrs) {
      const prNumber = pr.number;
      const prBody = pr.body || '';

      // 提取 RELEASE-TOOLKIT-OUTPUT 区域
      const match = prBody.match(
        new RegExp(`${escapeRegex(OUTPUT_START)}[\\s\\S]*?${escapeRegex(OUTPUT_END)}`),
      );

      if (match) {
        const log = match[0];
        // 移除标记和说明文字
        const cleanLog = log
          .replace(OUTPUT_START, '')
          .replace(OUTPUT_END, '')
          .replace(/> 📖.*?\n>?\n>?/g, '')
          .trim();

        if (cleanLog) {
          releaseLogs.push(`### PR #${prNumber}\n\n${cleanLog}`);
        }
      }
    }

    return releaseLogs.join('\n\n');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[preview] 远程聚合 release logs 失败：${msg}`);
    return '';
  }
}

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
    const config = loadConfig({
      cwd: options.cwd,
      configPath: options.configPath,
    });
    const hookRunner = new HookRunner([]);

    // 1. 加载插件
    const { plugins: iPlugins, formatters, errors: pluginErrors } = await loadPluginsAsIPlugin(config.plugins);
    if (pluginErrors.length > 0) {
      for (const e of pluginErrors) console.warn(`[preview] ${e}`);
    }
    hookRunner.setPlugins(iPlugins);

    // 2. 执行 beforePreview 钩子
    await hookRunner.runBeforePreview({
      packageName: '',
      oldVersion: '',
      newVersion: '',
      tagName: '',
    });

    // 3. 执行核心逻辑
    let versionDiffs: VersionDiffResult[];
    let aggregatedLog: string;

    const headRef = IS_WORKER
      ? process.env.GITHUB_HEAD_REF_NAME || process.env.GITHUB_SHA || 'HEAD'
      : 'HEAD';

    const workspacePatterns = await resolveWorkspacePackages(
      config.releasePreview.workspaceFile,
      IS_WORKER
        ? {
            headRef,
            api: {
              owner: options.owner,
              repo: options.repo,
              ref: headRef,
              token: options.token,
            },
          }
        : { cwd: options.cwd },
    );

    versionDiffs = await detectVersionChanges(
      config.branches.base,
      headRef,
      workspacePatterns.length > 0 ? workspacePatterns : ['packages/*'],
      options.cwd,
    );

    if (IS_WORKER) {
      aggregatedLog = await aggregateReleaseLogsByAPI(config.branches.base);
    } else {
      aggregatedLog = aggregateReleaseLogs(options.cwd);
    }

    const hasVersionChange = versionDiffs.length > 0;
    const noChangeMessage = config.releasePreview.noChangeMessage;

    // 判断 PR 是否已合并（用于区分预览模式和正式发布模式）
    const isMerged = process.env.GITHUB_PR_MERGED === 'true';

    const commentBody = formatReleasePreviewComment(
      hasVersionChange,
      versionDiffs,
      aggregatedLog,
      noChangeMessage,
      formatters,
      isMerged,
      config.releasePreview.previewOutput,
    );

    await postOrUpdateComment(context, commentBody);

    const result: ReleasePreviewResult = {
      success: true,
      prNumber: options.prNumber,
      hasVersionChange,
      versionDiffs,
      commentPosted: true,
    };

    // 4. 执行 afterPreview 钩子
    await hookRunner.runAfterPreview({
      packageName: '',
      oldVersion: '',
      newVersion: '',
      tagName: '',
    }, result);

    return result;
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
