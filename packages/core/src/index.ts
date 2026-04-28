// Types
export type {
  DiffType,
  PackageVersionInfo,
  VersionDiffResult,
  CommitType,
  ChangeLogEntry,
  ChangeLogOutput,
  IPlugin,
  ILineFormatter,
  ILogFormatter,
  GithubContext,
  CiRunnerOptions,
  FileWriteMode,
  FileOutputterOptions,
} from './types.js';

// Constants
export {
  DEFAULT_BASE_REF,
  DEFAULT_CHANGELOG_DIR,
  COMMENT_ANCHOR_START,
  COMMENT_ANCHOR_END,
  DEFAULT_PLUGINS,
  DIFF_TYPE_LABELS,
} from './constants.js';

// Git
export { GitReader } from './git/git-reader.js';

// Version
export { PackageScanner } from './version/version-diff-detector.js';

// Changelog (release-level and PR-level)
export {
  ChangelogCollector,
  ChangelogRenderer,
  type RendererOptions,
  saveReleaseSummary,
  listReleaseSummaries,
  renderPRChangelogMD,
  savePRChangelog,
  listPRChangeLogs,
  PR_CHANGELOG_DIR,
  RELEASE_LOG_START,
  RELEASE_LOG_END,
  PACKAGES_MARKER,
  extractReleaseLog,
  extractDeclaredPackages,
  type SavePRChangelogOptions,
  fetchPRData,
  type PRChangelogData,
  type PRMeta,
  type CommitTitle,
  type PRReviewNote,
  type PRRelatedInfo,
  type PRFetcherOptions,
  consumeAllSnapshots,
  collectEntriesFromSnapshots,
  type ConsumedSnapshot,
} from './changelog/index.js';

// Config
export { loadConfig, loadPRChangelogConfig, initConfig, CONFIG_DIR, CONFIG_FILE } from './config/index.js';
export type { ReleaseToolkitConfig, PRChangelogConfig } from './config/index.js';

// Plugin
export { PluginManager } from './plugin/plugin-manager.js';
export { Pipeline } from './plugin/pipeline.js';

// Output (CI layer)
export { GithubContextDetector } from './output/github-context-detector.js';
export { PRCommentPoster } from './output/pr-comment-poster.js';
export { FileOutputter } from './output/file-outputter.js';

// CI Runner
export { CiRunner } from './ci/ci-runner.js';
export type { CiRunResult } from './ci/ci-runner.js';

// Tag
export { TagManager } from './tag/tag-manager.js';
export type { TagResult, TagManagerOptions } from './tag/tag-manager.js';

// Publish
export { GithubReleaseCreator } from './publish/github-release-creator.js';
export type {
  ReleaseHookContext,
  GithubReleaseOptions,
  GithubReleaseResult,
} from './publish/github-release-creator.js';
