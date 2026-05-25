/**
 * Worker-safe 入口：仅导出无 node:fs / simple-git 依赖的 API。
 * 供 @release-toolkit/app-server（Cloudflare Workers）使用。
 */

export {
  detectVersionChangesWithOctokit,
  detectVersionChangesByAPI,
  listChangedPackagePathsWithOctokit,
  matchesWorkspaceFilePath,
} from './shared/version-api.js';
export type { RepoVersionContext } from './shared/version-api.js';

export {
  fetchWorkspacePackagesWithOctokit,
  fetchWorkspacePackagesByAPI,
  parseWorkspacePackages,
  workspaceContextFromEnv,
} from './shared/workspace-api.js';
export type { WorkspaceApiContext } from './shared/workspace-api.js';

export {
  resolveReleaseLogTextFromComments,
  logExtractionConfigFromRepo,
  needsCommentListForExtraction,
  isToolCommentBody,
  bodyHasReleaseLogMarkers,
  wrapToolComment,
} from './shared/log-extraction.js';
export type { LogExtractionConfig, CommentLike } from './shared/log-extraction.js';

export type { VersionDiffResult } from './shared/types.js';
