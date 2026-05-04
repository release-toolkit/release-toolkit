/** Emoji mapping for commit types */
export const COMMIT_TYPE_EMOJI = {
  feat: '✨',
  fix: '🐛',
  docs: '📝',
  style: '💄',
  refactor: '♻️',
  perf: '⚡️',
  test: '✅',
  build: '📦️',
  ci: '👷',
  chore: '🔧',
  revert: '⏪️',
} as const

/** Commit type to category mapping (for grouping in changelog) */
export const COMMIT_TYPE_CATEGORY = {
  feat: {
    name: 'Features',
    emoji: '✨',
  },
  fix: {
    name: 'Bug Fixes',
    emoji: '🐛',
  },
  perf: {
    name: 'Performance Improvements',
    emoji: '⚡️',
  },
  refactor: {
    name: 'Code Refactoring',
    emoji: '♻️',
  },
  docs: {
    name: 'Documentation',
    emoji: '📝',
  },
  style: {
    name: 'Styles',
    emoji: '💄',
  },
  test: {
    name: 'Tests',
    emoji: '✅',
  },
  build: {
    name: 'Build System',
    emoji: '📦️',
  },
  ci: {
    name: 'Continuous Integration',
    emoji: '👷',
  },
  chore: {
    name: 'Chores',
    emoji: '🔧',
  },
  revert: {
    name: 'Reverts',
    emoji: '⏪️',
  },
} as const
