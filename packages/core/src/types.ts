// ============================================================
// Version Diff Types
// ============================================================

export type DiffType = 'major' | 'minor' | 'patch' | null;

export interface PackageVersionInfo {
  /** Package name, e.g. @myorg/core */
  packageName: string;
  /** Relative path to package.json, e.g. packages/core/package.json */
  packagePath: string;
  /** Version on base branch */
  currentVersion: string;
  /** Version on head branch (current PR/commit) */
  newVersion: string;
}

export interface VersionDiffResult {
  package: PackageVersionInfo;
  /** semver.diff result, null if unchanged */
  diffType: DiffType;
}

// ============================================================
// Changelog Types
// ============================================================

export type CommitType =
  | 'feat'
  | 'fix'
  | 'docs'
  | 'style'
  | 'refactor'
  | 'perf'
  | 'test'
  | 'build'
  | 'ci'
  | 'chore'
  | 'revert';

export interface ChangeLogEntry {
  type: CommitType;
  scope?: string;
  subject: string;
  hash?: string;
  prNumber?: string;
  extraNote?: string;
  packageName?: string;
}

export interface ChangeLogOutput {
  version: string;
  date: string;
  entries: ChangeLogEntry[];
}

// ============================================================
// Plugin Types
// ============================================================

export interface PluginContext {
  cwd: string;
  options?: Record<string, unknown>;
}

export interface IPlugin {
  name: string;
  priority: number;
  init?(context: PluginContext): void | Promise<void>;
}

/** Stage 1: transform each entry individually. Return null to drop the entry. */
export interface ILineFormatter extends IPlugin {
  format(entry: ChangeLogEntry): ChangeLogEntry | null;
}

/** Stage 2: post-process the entire changelog document structure. */
export interface ILogFormatter extends IPlugin {
  format(changelog: ChangeLogOutput): ChangeLogOutput;
}

// ============================================================
// GitHub Context Types (CI mode)
// ============================================================

export interface GithubContext {
  isGitHubActions: boolean;
  eventName: string;
  sha: string;
  ref: string;
  baseRef?: string;
  baseSha?: string;
  prNumber?: number;
  repoOwner?: string;
  repoName?: string;
  token?: string;
}

// ============================================================
// CI Runner Options
// ============================================================

export interface CiRunnerOptions {
  baseRef: string;
  changelogDir: string;
  outputPath: string;
  commentPr: boolean;
  dryRun: boolean;
  plugins: string[];
  pluginOptions: Record<string, unknown>;
}

// ============================================================
// Output Types
// ============================================================

export type FileWriteMode = 'append' | 'overwrite';

export interface FileOutputterOptions {
  filePath: string;
  content: string;
  mode: FileWriteMode;
}
