/** Emoji mapping for commit types（与 @release-toolkit/markdown 同源） */
export { COMMIT_TYPE_EMOJI } from '@release-toolkit/markdown';

/** Commit type to category mapping (for grouping in changelog) */
export const COMMIT_TYPE_CATEGORY: Record<string, { name: string; emoji: string }> = {
  feat: { name: 'Features', emoji: '✨' },
  fix: { name: 'Bug Fixes', emoji: '🐛' },
  perf: { name: 'Performance Improvements', emoji: '⚡️' },
  refactor: { name: 'Code Refactoring', emoji: '♻️' },
  docs: { name: 'Documentation', emoji: '📝' },
  style: { name: 'Styles', emoji: '💄' },
  test: { name: 'Tests', emoji: '✅' },
  build: { name: 'Build System', emoji: '📦️' },
  ci: { name: 'Continuous Integration', emoji: '👷' },
  chore: { name: 'Chores', emoji: '🔧' },
  revert: { name: 'Reverts', emoji: '⏪️' },
};
