/** Shared type definitions for release-toolkit */

export type DiffType = 'major' | 'minor' | 'patch' | null;

export interface PackageVersionInfo {
  packageName: string;
  packagePath: string;
  currentVersion: string;
  newVersion: string;
}

export interface VersionDiffResult {
  package: PackageVersionInfo;
  diffType: DiffType;
}

export interface GithubContext {
  isGitHubActions: boolean;
  eventName: string;
  prNumber?: number;
  repoOwner?: string;
  repoName?: string;
  token?: string;
  baseRef?: string;
  headRef?: string;
}
