import { GitReader } from '../git/git-reader.js';
import { VersionDiffResult } from '../types.js';

export interface TagResult {
  packageName: string;
  version: string;
  tagName: string;
  created: boolean;
  pushed: boolean;
}

export interface TagManagerOptions {
  /** Working directory, defaults to process.cwd() */
  cwd?: string;
  /** Dry-run mode: only print, do not create or push tags */
  dryRun?: boolean;
}

export class TagManager {
  private cwd: string;
  private gitReader: GitReader;
  private dryRun: boolean;

  constructor(options: TagManagerOptions = {}) {
    this.cwd = options.cwd || process.cwd();
    this.dryRun = options.dryRun ?? false;
    this.gitReader = new GitReader(this.cwd);
  }

  /**
   * Create and push git tags for packages that have version changes.
   * Only tags packages present in the versionDiffs list.
   */
  async createAndPushTagsForDiffs(versionDiffs: VersionDiffResult[]): Promise<TagResult[]> {
    const results: TagResult[] = [];

    for (const diff of versionDiffs) {
      // Skip packages with no actual version change
      if (!diff.diffType) continue;

      const pkg = diff.package;
      const tagName = `${pkg.packageName}@${pkg.newVersion}`;

      if (this.dryRun) {
        console.log(`[TagManager] [DRY-RUN] Would create tag: ${tagName}`);
        results.push({ packageName: pkg.packageName, version: pkg.newVersion, tagName, created: false, pushed: false });
        continue;
      }

      let created = false;
      try {
        await this.gitReader.tag(tagName, `Release ${tagName}`);
        created = true;
        console.log(`[TagManager] Created tag: ${tagName}`);
      } catch (error) {
        console.warn(`[TagManager] Failed to create tag ${tagName}:`, error);
      }

      results.push({ packageName: pkg.packageName, version: pkg.newVersion, tagName, created, pushed: false });
    }

    // Push all created tags at once
    const createdTags = results.filter((r) => r.created);
    if (createdTags.length > 0 && !this.dryRun) {
      try {
        await this.gitReader.pushTags();
        console.log(`[TagManager] Pushed ${createdTags.length} tag(s) to remote`);
        for (const result of results) {
          if (result.created) result.pushed = true;
        }
      } catch (error) {
        console.error('[TagManager] Failed to push tags:', error);
      }
    }

    return results;
  }
}

