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
  COMMIT_TYPE_EMOJI,
  DIFF_TYPE_LABELS,
  COMMIT_TYPE_CATEGORY,
} from './constants.js';

// Git
export { GitReader } from './git/git-reader.js';

// Version
export { PackageScanner } from './version/version-diff-detector.js';

// Changelog
export { ChangelogCollector } from './changelog/collector.js';
export { ChangelogRenderer } from './changelog/renderer.js';
export type { RendererOptions } from './changelog/renderer.js';
export { ChangelogFileReader } from './changelog/file-reader.js';
export { saveReleaseSummary, listReleaseSummaries } from './changelog/history.js';
export { renderPRChangelogMD, savePRChangelog, listPRChangeLogs, RELEASE_LOG_START, RELEASE_LOG_END, extractReleaseLog } from './changelog/pr-changelog-template.js';
export { fetchPRData } from './changelog/pr-fetcher.js';
export type {
  PRChangelogData,
  PRMeta,
  CommitTitle,
  PRReviewNote,
  PRRelatedInfo,
} from './changelog/pr-changelog-types.js';
export type { PRFetcherOptions } from './changelog/pr-fetcher.js';

// Config
export { loadConfig, CONFIG_DIR, CONFIG_FILE } from './config/index.js';
export type { ReleaseToolkitConfig } from './config/index.js';

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
