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
  LoadedPlugins,
  LoadPluginsResult,
  ReleaseHookContext,
  PRLogCollectorResult,
  ReleasePreviewResult,
  ReleasePublisherResult,
} from './types.js';

export { loadConfig, CONFIG_DIR, CONFIG_FILE, DEFAULT_CONFIG } from './config/index.js';
export type { ReleaseToolkitConfig } from './config/index.js';

export {
  createOctokit,
  getPR,
  getPRComments,
  createPRComment,
  updatePRComment,
  updatePR,
} from './github/api-client.js';
export { postOrUpdateComment } from './github/pr-commenter.js';
export type { PRCommenterOptions } from './github/pr-commenter.js';
export { detectGithubContext } from './github/context-detector.js';

export { diffFiles, showFileContent, getCurrentSha, createTag, pushTags } from './git/git-reader.js';

export {
  loadPlugins,
  loadPluginsAsIPlugin,
  loadLogParser,
  applyFormatters,
  applyFormatLine,
  parseChangelog,
} from './plugins/index.js';

export { HookRunner } from './hook-runner.js';
export type { HookResult } from './hook-runner.js';

// Version detection & workspace scanning
export { detectVersionChanges, resolvePackageDirs, compareVersions } from './version.js';
export { scanWorkspace } from './workspace.js';
export { aggregateReleaseLogs } from './changelog-aggregator.js';

// Utils
export { IS_WORKER, OUTPUT_MARKERS, escapeRegex, parseGithubRepository } from './utils.js';
