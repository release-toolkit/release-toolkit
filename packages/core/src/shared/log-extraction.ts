import {
  bodyHasReleaseLogMarkers,
  isToolCommentBody,
  RELEASE_LOG_END,
  RELEASE_LOG_START,
  type ReleaseLogMarkers,
} from '@release-toolkit/markdown';

/** Worker / 纯函数场景下的日志提取配置（与 ReleaseToolkitConfig.prLogCollector 对齐） */
export interface LogExtractionConfig {
  releaseLogMarker?: ReleaseLogMarkers;
  logExtraction?: {
    source?: 'comment' | 'pr-body';
    commentPosition?: 'first' | 'latest';
  };
}

export interface CommentLike {
  body?: string | null;
  created_at?: string;
}

function resolveMarkers(config: LogExtractionConfig): ReleaseLogMarkers {
  return {
    start: config.releaseLogMarker?.start ?? RELEASE_LOG_START,
    end: config.releaseLogMarker?.end ?? RELEASE_LOG_END,
  };
}

/**
 * comment 模式下是否需要拉取 PR 评论列表。
 * body 已含 RELEASE-LOG 标记时可跳过，减少 GitHub API 调用。
 */
export function needsCommentListForExtraction(
  prBody: string | null,
  config: LogExtractionConfig,
): boolean {
  const source = config.logExtraction?.source ?? 'comment';
  if (source !== 'comment') return false;
  return !bodyHasReleaseLogMarkers(prBody, resolveMarkers(config));
}

/**
 * 按 logExtraction 从 PR 描述体或评论列表中选取含 RELEASE-LOG 标记的文本。
 * 评论模式找不到标记时回退到 PR body；自动跳过工具自身评论。
 */
export function resolveReleaseLogTextFromComments(
  prBody: string | null,
  comments: CommentLike[],
  config: LogExtractionConfig,
): string | null {
  const source = config.logExtraction?.source ?? 'comment';

  if (source !== 'comment') {
    return prBody;
  }

  const markers = resolveMarkers(config);
  const hasMarkers = (text: string) => bodyHasReleaseLogMarkers(text, markers);

  if (prBody && hasMarkers(prBody)) {
    return prBody;
  }

  if (comments.length === 0) {
    return prBody;
  }

  const position = config.logExtraction?.commentPosition ?? 'first';
  const sorted = [...comments].sort((a, b) => {
    const ta = new Date(a.created_at ?? 0).getTime();
    const tb = new Date(b.created_at ?? 0).getTime();
    return position === 'first' ? ta - tb : tb - ta;
  });

  for (const comment of sorted) {
    const body = comment.body ?? '';
    if (isToolCommentBody(body)) continue;
    if (hasMarkers(body)) {
      return body;
    }
  }

  return prBody;
}

/** 从仓库 config.json 的 prLogCollector 段解析 LogExtractionConfig */
export function logExtractionConfigFromRepo(
  config: Record<string, unknown> | null | undefined,
): LogExtractionConfig {
  if (!config || typeof config !== 'object') return {};
  const prLog = config.prLogCollector;
  if (!prLog || typeof prLog !== 'object') return {};

  const section = prLog as {
    releaseLogMarker?: ReleaseLogMarkers;
    logExtraction?: LogExtractionConfig['logExtraction'];
  };

  return {
    releaseLogMarker: section.releaseLogMarker,
    logExtraction: section.logExtraction,
  };
}

export { isToolCommentBody, bodyHasReleaseLogMarkers, wrapToolComment } from '@release-toolkit/markdown';
