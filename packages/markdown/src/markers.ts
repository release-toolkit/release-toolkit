/** PR 描述体中用户编辑的 RELEASE-LOG 标记 */
export const RELEASE_LOG_START = '<!-- RELEASE-LOG-START -->';
export const RELEASE_LOG_END = '<!-- RELEASE-LOG-END -->';

/** 工具写入 PR 描述体的结构化输出区 */
export const OUTPUT_START = '<!-- RELEASE-TOOLKIT-OUTPUT-START -->';
export const OUTPUT_END = '<!-- RELEASE-TOOLKIT-OUTPUT-END -->';

/** PR 评论锚点（用于 upsert 同一条工具评论） */
export const COMMENT_ANCHOR_START = '<!-- release-toolkit-comment-start -->';
export const COMMENT_ANCHOR_END = '<!-- release-toolkit-comment-end -->';

export interface ReleaseLogMarkers {
  start: string;
  end: string;
}

export const DEFAULT_RELEASE_LOG_MARKERS: ReleaseLogMarkers = {
  start: RELEASE_LOG_START,
  end: RELEASE_LOG_END,
};
