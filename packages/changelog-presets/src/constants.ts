// ============================================================
// Formatting constants — moved from @release-toolkit/core
// These belong to the formatting layer, not the core data layer
// ============================================================

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
