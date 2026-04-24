/** Default git base branch for version comparison */
export const DEFAULT_BASE_REF = 'main';

/** Fallback base branch name */
export const FALLBACK_BASE_REFS = ['main', 'master', 'develop'] as const;

/** Default glob pattern for package.json in monorepo */
export const PACKAGE_JSON_GLOB = '**/package.json';

/** Default changelog output filename */
export const DEFAULT_CHANGELOG_FILE = 'CHANGELOG.md';

/** Default directory for accumulated changelog JSON files */
export const DEFAULT_CHANGELOG_DIR = '.changelog';

/** Anchor markers for PR comment updates */
export const COMMENT_ANCHOR_START = '<!-- release-tool-report-start -->';
export const COMMENT_ANCHOR_END = '<!-- release-tool-report-end -->';

/** Default plugins enabled in CI mode */
export const DEFAULT_PLUGINS = ['emoji-prefix', 'category-group'] as const;

/** Emoji mapping for commit types */
export const COMMIT_TYPE_EMOJI: Record<string, string> = {
  feat: '✨',
  fix: '🐛',
  docs: '📝',
  style: '💄',
  refactor: '♻️',
  perf: '⚡',
  test: '✅',
  build: '📦',
  ci: '👷',
  chore: '🔧',
  revert: '⏪',
};

/** Diff type display labels and colors */
export const DIFF_TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  major: { label: 'MAJOR', emoji: '🔴' },
  minor: { label: 'MINOR', emoji: '🟡' },
  patch: { label: 'PATCH', emoji: '🟢' },
};

/** Commit type to category mapping (for grouping in changelog) */
export const COMMIT_TYPE_CATEGORY: Record<string, { name: string; emoji: string }> = {
  feat: { name: 'Features', emoji: '✨' },
  fix: { name: 'Bug Fixes', emoji: '🐛' },
  perf: { name: 'Performance', emoji: '⚡' },
  refactor: { name: 'Refactoring', emoji: '♻️' },
  docs: { name: 'Documentation', emoji: '📝' },
  test: { name: 'Tests', emoji: '✅' },
  build: { name: 'Build & CI', emoji: '🔧' },
  ci: { name: 'Build & CI', emoji: '🔧' },
  chore: { name: 'Chores', emoji: '🔨' },
  style: { name: 'Chores', emoji: '🔨' },
  revert: { name: 'Reverts', emoji: '⏪' },
};
