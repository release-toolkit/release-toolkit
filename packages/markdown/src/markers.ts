/** PR 描述体中用户编辑的 RELEASE-LOG 标记 */
export const RELEASE_LOG_START = '<!-- RELEASE-LOG-START -->';
export const RELEASE_LOG_END = '<!-- RELEASE-LOG-END -->';

/** 工具写入 PR 描述体的结构化输出区 */
export const OUTPUT_START = '<!-- RELEASE-TOOLKIT-OUTPUT-START -->';
export const OUTPUT_END = '<!-- RELEASE-TOOLKIT-OUTPUT-END -->';

/** PR 评论锚点（用于 upsert 同一条工具评论） */
export const COMMENT_ANCHOR_START = '<!-- release-toolkit-comment-start -->';
export const COMMENT_ANCHOR_END = '<!-- release-toolkit-comment-end -->';

/** 历史锚点（升级后仍识别并迁移到新锚点） */
export const LEGACY_COMMENT_ANCHOR_STARTS = [
  '<!-- release-toolkit-report-start -->',
  '<!-- release-tool-report-start -->',
] as const;

export interface ReleaseLogMarkers {
  start: string;
  end: string;
}

export const DEFAULT_RELEASE_LOG_MARKERS: ReleaseLogMarkers = {
  start: RELEASE_LOG_START,
  end: RELEASE_LOG_END,
};

/** 与 core 历史 API 兼容的对象形式 */
export const OUTPUT_MARKERS = {
  START: OUTPUT_START,
  END: OUTPUT_END,
} as const;

/** 判断评论是否为 release-toolkit 工具评论（含当前或历史锚点） */
export function isToolCommentBody(body: string | null | undefined): boolean {
  if (!body) return false;
  if (body.includes(COMMENT_ANCHOR_START)) return true;
  return LEGACY_COMMENT_ANCHOR_STARTS.some((anchor) => body.includes(anchor));
}

/** 判断文本是否含 RELEASE-LOG 标记区 */
export function bodyHasReleaseLogMarkers(
  body: string | null | undefined,
  markers: ReleaseLogMarkers = DEFAULT_RELEASE_LOG_MARKERS,
): boolean {
  if (!body) return false;
  return body.includes(markers.start) && body.includes(markers.end);
}

/** 用当前标准锚点包裹工具评论正文 */
export function wrapToolComment(body: string): string {
  return `${COMMENT_ANCHOR_START}\n${body}\n${COMMENT_ANCHOR_END}`;
}
