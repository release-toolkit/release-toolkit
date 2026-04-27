export { ChangelogCollector } from './collector.js';
export { ChangelogRenderer } from './renderer.js';
export type { RendererOptions } from './renderer.js';
export { ChangelogFileReader } from './file-reader.js';

// Release history (per-release summary)
export { saveReleaseSummary, listReleaseSummaries } from './history.js';

// PR-level changelog (per-PR change record)
export {
  renderPRChangelogMD,
  savePRChangelog,
  listPRChangeLogs,
  PR_CHANGELOG_DIR,
  RELEASE_LOG_START,
  RELEASE_LOG_END,
  PACKAGES_MARKER,
  extractReleaseLog,
  extractDeclaredPackages,
} from './pr-changelog-template.js';
export type { SavePRChangelogOptions } from './pr-changelog-template.js';
export type {
  PRChangelogData,
  PRMeta,
  CommitTitle,
  PRReviewNote,
  PRRelatedInfo,
} from './pr-changelog-types.js';
export { fetchPRData } from './pr-fetcher.js';
export type { PRFetcherOptions } from './pr-fetcher.js';
