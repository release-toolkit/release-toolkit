import type { ReleaseToolkitConfig } from '../../shared/config/index.js';
import type { GithubContext } from '../../shared/types.js';
import { getPRComments } from '../../shared/github/api-client.js';
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
  const source = config.prLogCollector?.logExtraction?.source ?? 'pr-body';

  if (source !== 'comment') {
    return prBody;
  }

  const startMarker =
    config.prLogCollector?.releaseLogMarker?.start ?? '<!-- RELEASE-LOG-START -->';
  const endMarker =
    config.prLogCollector?.releaseLogMarker?.end ?? '<!-- RELEASE-LOG-END -->';

  const hasMarkers = (text: string) =>
    text.includes(startMarker) && text.includes(endMarker);

  if (prBody && hasMarkers(prBody)) {
    return prBody;
  }

  const { data: comments } = await getPRComments(context);
  if (comments.length === 0) {
    return prBody;
  }

  const position = config.prLogCollector?.logExtraction?.commentPosition ?? 'first';
  const sorted = [...comments].sort((a, b) => {
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    return position === 'first' ? ta - tb : tb - ta;
  });

  for (const comment of sorted) {
    const body = comment.body ?? '';
    if (hasMarkers(body)) {
      return body;
    }
  }

  return prBody;
}

/** 从已选定的文本中解析 RELEASE-LOG（与 resolveReleaseLogText 配合使用） */
export function parseReleaseLogFromText(
  text: string | null,
  config: ReleaseToolkitConfig,
): ExtractResult {
  return extractReleaseLog(text, config);
}
