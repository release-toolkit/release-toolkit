import type { ReleaseHookContext } from '../../shared/types.js';
import type { AfterReleaseHook, HookCommand } from '../../shared/config/index.js';

export type { ReleaseHookContext, AfterReleaseHook, HookCommand };

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
