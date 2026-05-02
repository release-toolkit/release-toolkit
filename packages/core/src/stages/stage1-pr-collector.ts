/**
 * Stage 1: PR Changelog Collector
 *
 * Triggered when: PR is opened/updated targeting dev branch
 * What it does:
 *   1. Fetch PR data from GitHub API
 *   2. Render changelog markdown
 *   3. Save snapshot to .releasetoolkit/changelog/prs/
 *   4. Post/Update PR comment with changelog preview
 *
 * Architecture: Pure logic class, no CLI dependencies
 * Future: Can easily change execution order or add/remove steps
 */

import { fetchPRData, savePRChangelog, renderPRChangelogMD } from '../changelog/index.js';
import { PRCommentPoster } from '../output/pr-comment-poster.js';
import type { PRChangelogData, SavePRChangelogOptions } from '../changelog/index.js';

export interface Stage1Options {
  /** PR number */
  prNumber: number;
  /** GitHub owner (org or user) */
  owner: string;
  /** GitHub repository name */
  repo: string;
  /** GitHub token */
  token: string;
  /** Save snapshot to disk (default: true) */
  save?: boolean;
  /** Skip if snapshot already exists (default: false) */
  skipIfExists?: boolean;
  /** Post/Update PR comment (default: false) */
  postComment?: boolean;
  /** Working directory (default: process.cwd()) */
  cwd?: string;
}

export interface Stage1Result {
  success: boolean;
  prNumber: number;
  markdown: string;
  savedPath?: string;
  commentPosted: boolean;
  error?: string;
}

export class Stage1PRCollector {
  private options: Required<Omit<Stage1Options, 'cwd'>> & { cwd: string };

  constructor(options: Stage1Options) {
    this.options = {
      save: true,
      skipIfExists: false,
      postComment: false,
      cwd: process.cwd(),
      ...options,
    };
  }

  /**
   * Execute Stage 1: Collect PR changelog and optionally post comment
   */
  async run(): Promise<Stage1Result> {
    const { prNumber, owner, repo, token, cwd } = this.options;

    console.log(`\n[Stage1] Starting PR changelog collection for PR #${prNumber}...`);

    try {
      // Step 1: Fetch PR data from GitHub API
      console.log('[Stage1] Step 1: Fetching PR data...');
      const prData = await this.fetchPRData();

      // Step 2: Render changelog markdown
      console.log('[Stage1] Step 2: Rendering changelog markdown...');
      const markdown = this.renderMarkdown(prData);

      // Step 3: Save snapshot (optional)
      let savedPath: string | undefined;
      if (this.options.save) {
        console.log('[Stage1] Step 3: Saving snapshot...');
        savedPath = this.saveSnapshot(prData);
      }

      // Step 4: Post/Update PR comment (optional)
      let commentPosted = false;
      if (this.options.postComment) {
        console.log('[Stage1] Step 4: Posting PR comment...');
        commentPosted = await this.postComment(markdown);
      }

      console.log(`[Stage1] ✓ Completed for PR #${prNumber}\n`);

      return {
        success: true,
        prNumber,
        markdown,
        savedPath,
        commentPosted,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Stage1] ✗ Failed for PR #${prNumber}:`, errorMsg);

      return {
        success: false,
        prNumber,
        markdown: '',
        commentPosted: false,
        error: errorMsg,
      };
    }
  }

  /**
   * Step 1: Fetch PR data from GitHub API
   */
  private async fetchPRData(): Promise<PRChangelogData> {
    const { owner, repo, token, prNumber } = this.options;

    return await fetchPRData({
      owner,
      repo,
      token,
      prNumber,
    });
  }

  /**
   * Step 2: Render changelog markdown
   */
  private renderMarkdown(data: PRChangelogData): string {
    return renderPRChangelogMD(data);
  }

  /**
   * Step 3: Save snapshot to disk
   */
  private saveSnapshot(data: PRChangelogData): string | undefined {
    const { cwd, skipIfExists } = this.options;

    const saveOptions: SavePRChangelogOptions = {
      overwrite: skipIfExists ? 'skip' : 'overwrite',
    };

    const savedPath = savePRChangelog(cwd, data, saveOptions);

    if (savedPath) {
      const relPath = this.relativePath(savedPath);
      if (skipIfExists && !this.options.skipIfExists) {
        console.log(`[Stage1] ✓ Saved: ${relPath}`);
      } else if (skipIfExists) {
        console.log(`[Stage1] ℹ Skipped (already exists): ${relPath}`);
      }
    }

    return savedPath;
  }

  /**
   * Step 4: Post or update PR comment
   */
  private async postComment(markdown: string): Promise<boolean> {
    const { owner, repo, token, prNumber } = this.options;

    try {
      const poster = new PRCommentPoster(owner, repo, token);
      const commentBody = this.buildCommentBody(markdown);
      await poster.postComment(prNumber, commentBody);
      console.log(`[Stage1] ✓ Comment posted/updated on PR #${prNumber}`);
      return true;
    } catch (error) {
      console.error('[Stage1] ✗ Failed to post comment:', error);
      return false;
    }
  }

  /**
   * Build PR comment body with anchor markers
   */
  private buildCommentBody(markdown: string): string {
    return `## 📝 PR Changelog Preview\n\n${markdown}`;
  }

  /**
   * Get relative path for display
   */
  private relativePath(absolutePath: string): string {
    const { cwd } = this.options;
    return absolutePath.replace(cwd + '/', '');
  }
}
