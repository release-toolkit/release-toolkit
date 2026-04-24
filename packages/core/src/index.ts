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
  PluginContext,
  GithubContext,
  CiRunnerOptions,
  FileWriteMode,
  FileOutputterOptions,
} from './types.js';

// Constants
export {
  DEFAULT_BASE_REF,
  FALLBACK_BASE_REFS,
  PACKAGE_JSON_GLOB,
  DEFAULT_CHANGELOG_FILE,
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
