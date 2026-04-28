/** Default git base branch for version comparison */
export const DEFAULT_BASE_REF = 'main';

/** Default directory for accumulated changelog JSON files */
export const DEFAULT_CHANGELOG_DIR = '.changelog';

/** Anchor markers for PR comment updates */
export const COMMENT_ANCHOR_START = '<!-- release-tool-report-start -->';
export const COMMENT_ANCHOR_END = '<!-- release-tool-report-end -->';

/** Default plugins enabled in CI mode */
export const DEFAULT_PLUGINS = ['emoji-prefix', 'category-group', 'markdown-bold'] as const;

/** Diff type display labels and colors */
export const DIFF_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  major: { label: 'MAJOR', emoji: '🔴' },
  minor: { label: 'MINOR', emoji: '🟡' },
  patch: { label: 'PATCH', emoji: '🟢' },
};
