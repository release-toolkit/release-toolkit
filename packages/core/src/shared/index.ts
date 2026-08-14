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

export {
  loadConfig,
  CONFIG_DIR,
  CONFIG_FILE,
  LOCAL_CONFIG_DIR,
  DEFAULT_CONFIG,
  applyGitTagTemplate,
  resolveGitTagName,
  resolveGitTagMessage,
} from './config/index.js';
export type { ReleaseToolkitConfig, LoadConfigOptions } from './config/index.js';

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

export { PluginHookRunner, HookRunner } from './hook-runner.js';
export type { PluginHookResult, HookResult } from './hook-runner.js';

// Version detection & workspace scanning
export { detectVersionChanges, resolvePackageDirs, compareVersions } from './version.js';
export {
  scanWorkspace,
  resolveWorkspacePackages,
  parseWorkspacePackages,
} from './workspace.js';
export type { WorkspaceApiContext } from './workspace.js';
export {
  fetchWorkspacePackagesByAPI,
  fetchWorkspacePackagesWithOctokit,
  workspaceContextFromEnv,
} from './workspace-api.js';
export {
  detectVersionChangesByAPI,
  detectVersionChangesWithOctokit,
  listChangedPackagePathsWithOctokit,
  matchesWorkspaceFilePath,
} from './version-api.js';
export type { RepoVersionContext } from './version-api.js';
export { aggregateReleaseLogs } from './changelog-aggregator.js';

// Utils
export {
  IS_WORKER,
  parseGithubRepository,
  OUTPUT_MARKERS,
  OUTPUT_START,
  OUTPUT_END,
  escapeRegex,
  wrapOutputMarkers,
  upsertOutputInBody,
} from './utils.js';
