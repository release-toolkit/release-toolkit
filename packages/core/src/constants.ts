/** Default git base branch for version comparison */
export const DEFAULT_BASE_REF = 'main';

/** Default directory for accumulated changelog JSON files */
export const DEFAULT_CHANGELOG_DIR = '.changelog';

/** PR 评论 upsert 锚点（与 @release-toolkit/markdown 同源） */
export { COMMENT_ANCHOR_START, COMMENT_ANCHOR_END } from '@release-toolkit/markdown';

/** Default plugins enabled in CI mode */
export const DEFAULT_PLUGINS = ['emoji-prefix', 'category-group', 'markdown-bold'] as const;

/** Diff type display labels and colors */
export const DIFF_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  major: { label: 'MAJOR', emoji: '🔴' },
  minor: { label: 'MINOR', emoji: '🟡' },
  patch: { label: 'PATCH', emoji: '🟢' },
};
