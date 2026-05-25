import type { ReleaseToolkitConfig } from '../../shared/config/index.js';
import type { GithubContext } from '../../shared/types.js';
import { getPRComments } from '../../shared/github/api-client.js';
import {
  needsCommentListForExtraction,
  resolveReleaseLogTextFromComments,
} from '../../shared/log-extraction.js';
import { extractReleaseLog, type ExtractResult } from './release-log-extractor.js';

/**
 * 按 logExtraction 配置从 PR 描述体或评论中选取 RELEASE-LOG 来源文本。
 * 评论模式找不到标记时回退到 PR body。
 */
export async function resolveReleaseLogText(
  prBody: string | null,
  context: GithubContext,
  config: ReleaseToolkitConfig,
): Promise<string | null> {
  const extractionConfig = {
    releaseLogMarker: config.prLogCollector?.releaseLogMarker,
    logExtraction: config.prLogCollector?.logExtraction,
  };

  if (!needsCommentListForExtraction(prBody, extractionConfig)) {
    return resolveReleaseLogTextFromComments(prBody, [], extractionConfig);
  }

  const { data: comments } = await getPRComments(context);
  return resolveReleaseLogTextFromComments(prBody, comments, extractionConfig);
}

/** 从已选定的文本中解析 RELEASE-LOG（与 resolveReleaseLogText 配合使用） */
export function parseReleaseLogFromText(
  text: string | null,
  config: ReleaseToolkitConfig,
): ExtractResult {
  return extractReleaseLog(text, config);
}
