export interface ReleaseHookContext {
  packageName: string;
  oldVersion: string;
  newVersion: string;
  tagName: string;
}

export interface ReleasePublisherOptions {
  cwd?: string;
  dryRun?: boolean;
  owner?: string;
  repo?: string;
  token?: string;
}

export interface ReleasePublisherResult {
  success: boolean;
  releases: Array<{
    packageName: string;
    tagName: string;
    releaseUrl?: string;
  }>;
  errors: string[];
}
