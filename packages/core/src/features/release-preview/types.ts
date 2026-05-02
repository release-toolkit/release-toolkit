export interface PackageVersionDiff {
  packageName: string;
  packageDir: string;
  oldVersion: string;
  newVersion: string;
  diffType: 'major' | 'minor' | 'patch' | null;
}

export interface ReleasePreviewOptions {
  prNumber: number;
  owner: string;
  repo: string;
  token?: string;
  cwd?: string;
}

export interface ReleasePreviewResult {
  success: boolean;
  prNumber: number;
  hasVersionChange: boolean;
  versionDiffs: PackageVersionDiff[];
  commentPosted: boolean;
  error?: string;
}
