import type { VersionDiffResult } from '../../shared/types.js';

/** @deprecated 使用 VersionDiffResult 代替 */
export type PackageVersionDiff = VersionDiffResult;

export interface ReleasePreviewOptions {
  prNumber: number;
  owner: string;
  repo: string;
  token?: string;
  cwd?: string;
  /** 配置文件路径，相对 cwd 或绝对路径 */
  configPath?: string;
}

export interface ReleasePreviewResult {
  success: boolean;
  prNumber: number;
  hasVersionChange: boolean;
  versionDiffs: VersionDiffResult[];
  commentPosted: boolean;
  error?: string;
}
