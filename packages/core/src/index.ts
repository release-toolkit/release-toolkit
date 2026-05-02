// Shared: types
export type {
  DiffType,
  PackageVersionInfo,
  VersionDiffResult,
  GithubContext,
} from './shared/types.js';

// Shared: config
export {
  loadConfig,
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_CONFIG,
} from './shared/config/index.js';
export type { ReleaseToolkitConfig } from './shared/config/index.js';

// Shared: github
export {
  getOctokit,
  getPR,
  getPRComments,
  createPRComment,
  updatePRComment,
} from './shared/github/api-client.js';
export { postOrUpdateComment } from './shared/github/pr-commenter.js';
export type { PRCommenterOptions } from './shared/github/pr-commenter.js';
export { detectGithubContext } from './shared/github/context-detector.js';

// Shared: git
export {
  diffFiles,
  showFileContent,
  getCurrentSha,
  createTag,
  pushTags,
} from './shared/git/git-reader.js';

// Features: prLogCollector
export { collectPRLog } from './features/pr-log-collector/index.js';
export type {
  PRLogCollectorOptions,
  PRLogCollectorResult,
  PRMeta,
} from './features/pr-log-collector/types.js';

// Features: releasePreview
export { previewRelease } from './features/release-preview/index.js';
export type {
  ReleasePreviewOptions,
  ReleasePreviewResult,
  PackageVersionDiff,
} from './features/release-preview/types.js';

// Features: releasePublisher
export { publishRelease } from './features/release-publisher/index.js';
export type {
  ReleasePublisherOptions,
  ReleasePublisherResult,
  ReleaseHookContext,
} from './features/release-publisher/types.js';
