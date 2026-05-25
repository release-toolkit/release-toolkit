import {
  logExtractionConfigFromRepo,
  needsCommentListForExtraction,
  resolveReleaseLogTextFromComments,
} from '@release-toolkit/core/worker';
import {
  RELEASE_LOG_END,
  RELEASE_LOG_START,
  extractReleaseLogFromBody,
  type PackageChangeLog,
  type ReleaseLogMarkers,
} from '@release-toolkit/markdown';
import type { PRContext } from './format.js';
import type { GitHubClient } from './github-client.js';

export type ExtractedReleaseLog = {
  rawReleaseLog: string | null;
  packageChangeLogs: PackageChangeLog[];
};

function resolveMarkers(config: ReturnType<typeof logExtractionConfigFromRepo>): ReleaseLogMarkers {
  return {
    start: config.releaseLogMarker?.start ?? RELEASE_LOG_START,
    end: config.releaseLogMarker?.end ?? RELEASE_LOG_END,
  };
}

async function listPRComments(
  client: GitHubClient,
  ctx: Pick<PRContext, 'owner' | 'repo' | 'prNumber'>,
): Promise<Array<{ body?: string | null; created_at?: string }>> {
  return client.listIssueComments({
    owner: ctx.owner,
    repo: ctx.repo,
    issueNumber: ctx.prNumber,
  });
}

/**
 * 按仓库 config.json 的 logExtraction 配置，从 PR 评论或描述体解析 RELEASE-LOG。
 */
export async function resolveReleaseLogForPR(
  client: GitHubClient,
  prCtx: PRContext,
  repoConfig: Record<string, unknown> | null,
): Promise<ExtractedReleaseLog> {
  const extractionConfig = logExtractionConfigFromRepo(repoConfig);
  const markers = resolveMarkers(extractionConfig);

  let text = prCtx.prBody;
  if (needsCommentListForExtraction(prCtx.prBody, extractionConfig)) {
    const comments = await listPRComments(client, prCtx);
    text = resolveReleaseLogTextFromComments(prCtx.prBody, comments, extractionConfig);
  } else {
    text = resolveReleaseLogTextFromComments(prCtx.prBody, [], extractionConfig);
  }

  const { rawReleaseLog, packageChangeLogs } = extractReleaseLogFromBody(text, markers);
  return { rawReleaseLog, packageChangeLogs };
}
