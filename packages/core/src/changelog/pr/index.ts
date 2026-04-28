// PR-level changelog (per-PR change record)
export { fetchPRData, type PRFetcherOptions } from './fetcher/index.js';

export { renderPRChangelogMD } from './renderer.js';

export {
  savePRChangelog,
  listPRChangeLogs,
  type SavePRChangelogOptions,
} from './storage.js';

export {
  extractReleaseLog,
  extractDeclaredPackages,
  PR_CHANGELOG_DIR,
  RELEASE_LOG_START,
  RELEASE_LOG_END,
  PACKAGES_MARKER,
} from './comment-parser.js';

export type {
  PRChangelogData,
  PRMeta,
  CommitTitle,
  PRReviewNote,
  PRRelatedInfo,
} from './types.js';

// Snapshot consumer (for Stage 2 & 3)
export {
  consumeAllSnapshots,
  collectEntriesFromSnapshots,
  type ConsumedSnapshot,
} from './snapshot-consumer.js';
