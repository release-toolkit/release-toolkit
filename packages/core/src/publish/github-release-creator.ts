import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { GithubContextDetector } from '../output/github-context-detector.js';

export interface ReleaseHookContext {
  /** GitHub Release ID */
  releaseId: number;
  /** Release asset upload URL */
  uploadUrl: string;
  /** Tag name, e.g. @scope/core@1.0.0 */
  tagName: string;
  /** Release page HTML URL */
  htmlUrl: string;
  /** Package name */
  packageName: string;
  /** Package version */
  packageVersion: string;
}

export interface GithubReleaseOptions {
  /** Working directory */
  cwd?: string;
  /** Dry-run mode: only print, do not create releases or run hooks */
  dryRun?: boolean;
  /** Hook scripts to run after each release is created */
  afterRelease?: string[];
  /** Create releases as drafts (default: false) */
  draft?: boolean;
  /** Create prereleases (default: false) */
  prerelease?: boolean;
}

export interface GithubReleaseResult {
  tagName: string;
  packageName: string;
  packageVersion: string;
  releaseId?: number;
  htmlUrl?: string;
  uploadUrl?: string;
  hookExecuted: boolean;
  success: boolean;
}

export class GithubReleaseCreator {
  private options: Required<Pick<GithubReleaseOptions, 'cwd'>> &
    Omit<GithubReleaseOptions, 'cwd'>;
  private contextDetector: GithubContextDetector;
  private asyncExec = promisify(exec);

  constructor(options: GithubReleaseOptions = {}) {
    this.options = {
      cwd: options.cwd || process.cwd(),
      dryRun: options.dryRun ?? false,
      afterRelease: options.afterRelease,
      draft: options.draft ?? false,
      prerelease: options.prerelease ?? false,
    };
    this.contextDetector = new GithubContextDetector();
  }

  /**
   * Create GitHub Releases for the given tags.
   * Each tag is expected in the format: <packageName>@<version>
   * @param tags Tag names to create releases for
   * @param body Markdown content for the release body (e.g. generated changelog)
   */
  async createReleases(tags: string[], body?: string): Promise<GithubReleaseResult[]> {
    const githubCtx = this.contextDetector.detect();

    if (!githubCtx.isGitHubActions || !githubCtx.token || !githubCtx.repoOwner || !githubCtx.repoName) {
      console.error(
        '[GithubReleaseCreator] Not in GitHub Actions or missing credentials ' +
          '(GITHUB_TOKEN, GITHUB_REPOSITORY). Set GITHUB_TOKEN env var.',
      );
      return tags.map((tag) => this.failedResult(tag, 'Missing GitHub context or token'));
    }

    const octokit = await this.getOctokit(githubCtx.token);
    // Use provided body or fallback to a simple message
    const changelogBody = body || 'See changelog for details.';
    const results: GithubReleaseResult[] = [];

    for (const tagName of tags) {
      const { packageName, packageVersion } = this.parseTagName(tagName);

      if (this.options.dryRun) {
        console.log(`[GithubReleaseCreator] [DRY-RUN] Would create release for tag: ${tagName}`);
        results.push({
          tagName,
          packageName,
          packageVersion,
          hookExecuted: false,
          success: true,
        });
        continue;
      }

      try {
        console.log(`[GithubReleaseCreator] Creating release for tag: ${tagName}`);

        const release = await octokit.rest.repos.createRelease({
          owner: githubCtx.repoOwner,
          repo: githubCtx.repoName,
          tag_name: tagName,
          name: tagName,
          body: changelogBody,
          draft: this.options.draft,
          prerelease: this.options.prerelease,
        });

        const hookContext: ReleaseHookContext = {
          releaseId: release.data.id,
          uploadUrl: release.data.upload_url,
          tagName,
          htmlUrl: release.data.html_url,
          packageName,
          packageVersion,
        };

        console.log(`[GithubReleaseCreator] Release created: ${release.data.html_url}`);

        // Run afterRelease hooks
        let hookExecuted = false;
        if (this.options.afterRelease && this.options.afterRelease.length > 0) {
          hookExecuted = await this.runHooks(hookContext);
        }

        results.push({
          tagName,
          packageName,
          packageVersion,
          releaseId: release.data.id,
          htmlUrl: release.data.html_url,
          uploadUrl: release.data.upload_url,
          hookExecuted,
          success: true,
        });
      } catch (error) {
        console.error(`[GithubReleaseCreator] Failed to create release for ${tagName}:`, error);
        results.push(this.failedResult(tagName, String(error)));
      }
    }

    return results;
  }

  /** Parse tag name to extract package name and version.
   *  Supports: @scope/pkg@1.0.0, pkg@1.0.0 */
  private parseTagName(tagName: string): { packageName: string; packageVersion: string } {
    const lastAtIndex = tagName.lastIndexOf('@');
    if (lastAtIndex <= 0) {
      // No version separator found (e.g. "v1.0.0" without scope)
      return { packageName: tagName, packageVersion: '' };
    }
    return {
      packageName: tagName.substring(0, lastAtIndex),
      packageVersion: tagName.substring(lastAtIndex + 1),
    };
  }

  /** Run afterRelease hook scripts with environment variable injection (async, non-blocking) */
  private async runHooks(context: ReleaseHookContext): Promise<boolean> {
    const envVars: Record<string, string> = {
      RELEASE_ID: String(context.releaseId),
      RELEASE_UPLOAD_URL: context.uploadUrl,
      RELEASE_TAG_NAME: context.tagName,
      RELEASE_HTML_URL: context.htmlUrl,
      PACKAGE_NAME: context.packageName,
      PACKAGE_VERSION: context.packageVersion,
    };

    let allSucceeded = true;

    for (const script of this.options.afterRelease || []) {
      try {
        console.log(`[GithubReleaseCreator] Running afterRelease hook: ${script}`);
        await this.asyncExec(script, {
          cwd: this.options.cwd,
          env: { ...process.env, ...envVars },
          stdio: 'inherit',
        });
        console.log(`[GithubReleaseCreator] Hook completed: ${script}`);
      } catch (error) {
        console.error(`[GithubReleaseCreator] Hook failed: ${script}`, error);
        allSucceeded = false;
        // Best-effort: continue running remaining hooks
      }
    }

    return allSucceeded;
  }

  private async getOctokit(token: string) {
    const { Octokit } = await import('octokit');
    return new Octokit({ auth: token });
  }

  private failedResult(tagName: string, reason: string): GithubReleaseResult {
    const { packageName, packageVersion } = this.parseTagName(tagName);
    return {
      tagName,
      packageName,
      packageVersion,
      hookExecuted: false,
      success: false,
    };
  }
}
