// Shared: types
export type {
  DiffType,
  PackageVersionInfo,
  VersionDiffResult,
  GithubContext,
  ChangelogEntry,
  IPlugin,
  ILogParser,
  ILineFormatter,
  ILogFormatter,
  ChangelogFormatter,
} from './shared/types.js';

// Shared: config
export {
  loadConfig,
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_CONFIG,
} from './shared/config/index.js';
export type {
  ReleaseToolkitConfig,
  BranchesConfig,
  PRLogCollectorConfig,
  ReleasePreviewConfig,
  ReleasePublisherConfig,
  AfterReleaseHook,
  GitTagsConfig,
} from './shared/config/index.js';

// Shared: github
export {
  createOctokit,
  getPR,
  getPRComments,
  createPRComment,
  updatePRComment,
  updatePR,
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

// Shared: plugins
export {
  loadPlugins,
  loadPluginsAsIPlugin,
  loadLogParser,
  applyFormatters,
  applyFormatLine,
  parseChangelog,
} from './shared/plugins/index.js';

// Shared: version & workspace (API / Worker)
export {
  detectVersionChanges,
  detectVersionChangesByAPI,
  detectVersionChangesWithOctokit,
  listChangedPackagePathsWithOctokit,
  matchesWorkspaceFilePath,
  resolveWorkspacePackages,
  parseWorkspacePackages,
  fetchWorkspacePackagesByAPI,
  fetchWorkspacePackagesWithOctokit,
} from './shared/index.js';
export type { WorkspaceApiContext, RepoVersionContext } from './shared/index.js';

// Shared: publisher hooks
export {
  runPublisherHooks,
  runHooks,
  runHooksAndCheck,
  formatHookFailureMessages,
} from './features/release-publisher/hook-runner.js';
export type { PublisherHook, HookResult } from './features/release-publisher/hook-runner.js';

// Shared: utils
export {
  IS_WORKER,
  parseGithubRepository,
  OUTPUT_MARKERS,
  OUTPUT_START,
  OUTPUT_END,
  escapeRegex,
  wrapOutputMarkers,
  upsertOutputInBody,
} from './shared/utils.js';

// Features: prLogCollector
export { collectPRLog } from './features/pr-log-collector/index.js';
export { extractReleaseLog } from './features/pr-log-collector/release-log-extractor.js';
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
