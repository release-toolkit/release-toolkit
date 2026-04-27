import { CiRunnerOptions, VersionDiffResult } from '../types.js';
import { PackageScanner } from '../version/version-diff-detector.js';
import { ChangelogFileReader } from '../changelog/file-reader.js';
import { ChangelogCollector } from '../changelog/collector.js';
import { ChangelogRenderer } from '../changelog/renderer.js';
import { saveReleaseSummary } from '../changelog/history.js';
import { PluginManager } from '../plugin/plugin-manager.js';
import { Pipeline } from '../plugin/pipeline.js';
import { GithubContextDetector } from '../output/github-context-detector.js';
import { PRCommentPoster } from '../output/pr-comment-poster.js';
import { FileOutputter } from '../output/file-outputter.js';
import { TagManager } from '../tag/tag-manager.js';
import { GithubReleaseCreator } from '../publish/github-release-creator.js';
import { GitReader } from '../git/git-reader.js';
import { loadConfig } from '../config/index.js';
import { DEFAULT_BASE_REF, DEFAULT_PLUGINS, DIFF_TYPE_LABELS } from '../constants.js';
import * as semver from 'semver';

export class CiRunner {
  private options: Required<CiRunnerOptions>;
  private cwd: string;

  constructor(options: Partial<CiRunnerOptions> = {}, cwd: string = process.cwd()) {
    this.cwd = cwd;
    // Load with 3-level merge: defaults ← config file ← explicit options
    this.options = loadConfig(cwd, options);
  }

  /** Run the complete CI pipeline */
  async run(): Promise<CiRunResult> {
    const startTime = Date.now();
    let success = true;
    const errors: string[] = [];

    console.log('=== Release Tool CI Runner ===');
    console.log(`[CiRunner] Base ref: ${this.options.baseRef}`);
    console.log(`[CiRunner] Dry run: ${this.options.dryRun}`);

    // Step 1: Detect GitHub context
    console.log('\n[CiRunner] Step 0: Detecting environment...');
    const contextDetector = new GithubContextDetector();
    const githubCtx = contextDetector.detect();
    if (githubCtx.isGitHubActions) {
      console.log(
        `[CiRunner] Running in GitHub Actions - ${githubCtx.eventName} #${githubCtx.prNumber || '?'}`,
      );
      if (githubCtx.baseRef) {
        this.options.baseRef = githubCtx.baseRef;
        console.log(`[CiRunner] Using context baseRef: ${this.options.baseRef}`);
      }
    }

    // Step 2: Detect version diffs
    console.log('\n[CiRunner] Step 1: Detecting version changes...');
    const packageScanner = new PackageScanner(this.cwd);
    const versionDiffs = await packageScanner.detectVersionDiffs(this.options.baseRef);

    if (versionDiffs.length > 0) {
      console.log(PackageScanner.formatReport(versionDiffs));
    } else {
      console.log('[CiRunner] No version changes detected');
    }

    // Step 3: Read changelog files
    console.log('\n[CiRunner] Step 2: Reading changelog files...');
    const changelogReader = new ChangelogFileReader(this.cwd);
    const rawEntries = await changelogReader.readFromDirectory(this.options.changelogDir);
    console.log(`[CiRunner] Loaded ${rawEntries.length} changelog entries`);

    // Step 4: Setup & run plugin pipeline
    console.log('\n[CiRunner] Step 3: Setting up plugins...');
    const pluginManager = new PluginManager(this.cwd);

    for (const pluginName of this.options.plugins) {
      try {
        await pluginManager.loadByName(pluginName);
      } catch (error) {
        console.warn(`[CiRunner] Could not load plugin "${pluginName}", skipping`);
      }
    }
    console.log(`[CiRunner] Plugins loaded: [${pluginManager.getRegisteredNames().join(', ')}]`);

    const collector = new ChangelogCollector();
    const collectedEntries = collector.collect([rawEntries]);
    const pipeline = new Pipeline(pluginManager);
    const version = this.extractNewVersion(versionDiffs);
    const output = await pipeline.run(collectedEntries, version);

    // Step 5: Render output
    const repoUrl = await this.detectRepoUrl();
    const renderer = new ChangelogRenderer({ repoUrl });
    const markdown = renderer.renderMarkdown(output);
    console.log(
      `\n[CiRunner] Generated changelog:\n${'='.repeat(50)}\n${markdown}\n${'='.repeat(50)}`,
    );

    // Step 6: Write file
    console.log('\n[CiRunner] Step 4: Writing output file...');
    if (!this.options.dryRun) {
      try {
        const outputter = new FileOutputter();
        outputter.write({
          filePath: this.options.outputPath,
          content: markdown,
          mode: this.options.fileWriteMode,
        });
      } catch (error) {
        errors.push(`Failed to write file: ${error instanceof Error ? error.message : String(error)}`);
        success = false;
        console.error(`[CiRunner] Failed to write ${this.options.outputPath}:`, error);
      }
    } else {
      console.log(`[CiRunner] [DRY-RUN] Would write to ${this.options.outputPath}`);
    }

    // Step 5: Post PR comment
    if (!this.shouldPostComment(githubCtx)) {
      if (this.options.commentPr) {
        console.log(`\n[CiRunner] Step 5: Skipping PR comment${this.options.dryRun ? ' (dry-run)' : ' (not in GitHub Actions or missing credentials)'}`);
      }
    } else {
      try {
        console.log('\n[CiRunner] Step 5: Posting PR comment...');
        const commentBody = this.buildCommentBody(output, versionDiffs, markdown);
        const poster = new PRCommentPoster(
          githubCtx.repoOwner!,
          githubCtx.repoName!,
          githubCtx.token!,
        );
        await poster.postComment(githubCtx.prNumber!, commentBody);
        console.log('[CiRunner] PR comment posted successfully');
      } catch (error) {
        errors.push(`Failed to post PR comment: ${error instanceof Error ? error.message : String(error)}`);
        success = false;
        console.error('[CiRunner] Failed to post PR comment:', error);
      }
    }

    // Step 6: Create and push git tags
    let createdTags: string[] = [];
    if (this.options.createTags && versionDiffs.length > 0) {
      console.log('\n[CiRunner] Step 6: Creating git tags...');
      try {
        const tagManager = new TagManager({ cwd: this.cwd, dryRun: this.options.dryRun });
        const tagResults = await tagManager.createAndPushTagsForDiffs(versionDiffs);
        createdTags = tagResults.filter((r) => r.created || this.options.dryRun).map((r) => r.tagName);

        if (createdTags.length > 0) {
          console.log(`[CiRunner] Created tags: [${createdTags.join(', ')}]`);
        } else {
          console.log('[CiRunner] No tags created');
        }
      } catch (error) {
        errors.push(`Failed to create tags: ${error instanceof Error ? error.message : String(error)}`);
        success = false;
        console.error('[CiRunner] Failed to create tags:', error);
      }
    }

    // Step 7: Create GitHub Releases (auto-detect prerelease from versions)
    const releaseTargets = createdTags.length > 0
      ? createdTags
      : this.deriveReleaseTargets(versionDiffs);
    const isPrerelease = this.detectPrerelease(versionDiffs);

    if (this.options.createRelease && releaseTargets.length > 0) {
      console.log(`\n[CiRunner] Step 7: Creating GitHub Releases${isPrerelease ? ' (prerelease)' : ''}...`);
      try {
        const releaseCreator = new GithubReleaseCreator({
          cwd: this.cwd,
          afterRelease: this.options.afterRelease,
          dryRun: this.options.dryRun,
          draft: false,
          prerelease: isPrerelease,
        });

        const releaseResults = await releaseCreator.createReleases(releaseTargets, markdown);
        const succeeded = releaseResults.filter((r) => r.success);
        const failed = releaseResults.filter((r) => !r.success);

        console.log(
          `[CiRunner] Release results: ${succeeded.length} succeeded, ${failed.length} failed`,
        );
        for (const r of succeeded) {
          console.log(`  ✓ ${r.tagName} → ${r.htmlUrl || '[DRY-RUN]'}`);
        }
        for (const r of failed) {
          console.log(`  ✗ ${r.tagName}`);
        }

        if (failed.length > 0) {
          errors.push(`${failed.length} release(s) failed`);
          success = false;
        }
      } catch (error) {
        errors.push(`Failed to create releases: ${error instanceof Error ? error.message : String(error)}`);
        success = false;
        console.error('[CiRunner] Failed to create releases:', error);
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n[CiRunner] Done! (${duration}s)`);

    if (errors.length > 0) {
      console.warn(`[CiRunner] Errors encountered:`);
      for (const e of errors) {
        console.warn(`  - ${e}`);
      }
    }

    const changed = versionDiffs.some((d) => d.diffType !== null);

    // Save release summary to .releasetoolkit/changelog/
    if (changed && !this.options.dryRun) {
      try {
        const savedPath = saveReleaseSummary(this.cwd, {
          version: output.version,
          date: new Date().toISOString(),
          versionDiffs,
          tagsCreated: createdTags,
          dryRun: this.options.dryRun,
          markdown,
        });
        console.log(`[CiRunner] Release summary saved: ${mdPath}`);
      } catch (error) {
        console.warn('[CiRunner] Failed to save release summary:', error);
      }
    }

    return {
      success,
      changed,
      versionDiffs,
      entryCount: output.entries.length,
      markdown,
      dryRun: this.options.dryRun,
    };
  }

  private extractNewVersion(diffs: VersionDiffResult[]): string {
    // Find the highest version bump as representative
    const priority = { major: 3, minor: 2, patch: 1 };
    let best: VersionDiffResult | null = null;

    for (const diff of diffs) {
      if (!diff.diffType) continue;
      if (!best || priority[diff.diffType!] > priority[best.diffType!]) {
        best = diff;
      }
    }

    return best?.package.newVersion || 'unreleased';
  }

  private buildCommentBody(
    output: import('../types.js').ChangeLogOutput,
    versionDiffs: VersionDiffResult[],
    markdown: string,
  ): string {
    const lines: string[] = [];

    lines.push('## 🚀 Release Report');
    lines.push('');
    lines.push(`**Version:** \`${output.version}\` | **Date:** \`${output.date}\``);
    lines.push(`**Changes:** \`${output.entries.length}\` entry/entries`);

    if (versionDiffs.length > 0) {
      const changed = versionDiffs.filter((d) => d.diffType !== null);
      if (changed.length > 0) {
        lines.push('');
        lines.push('### 📦 Version Updates:');
        lines.push('| Package | Old | New | Type |');
        lines.push('|---------|-----|-----|------|');

        for (const diff of changed) {
          const label = DIFF_TYPE_LABELS[diff.diffType!];
          lines.push(
            `| \`${diff.package.packageName}\` | \`${diff.package.currentVersion}\` | \`${diff.package.newVersion}\` | ${label ? `${label.emoji} ${label.label}` : diff.diffType!} |`,
          );
        }
      }
    }

    lines.push('');
    lines.push('### 📝 Changelog:');
    lines.push(markdown);

    return lines.join('\n');
  }

  /** #7: Check if PR comment should be posted (flattens nested conditions) */
  private shouldPostComment(ctx: import('../types.js').GithubContext): boolean {
    if (!this.options.commentPr) return false;
    if (this.options.dryRun) {
      console.log(`\n[CiRunner] Step 5: [DRY-RUN] Would post PR comment`);
      return false;
    }
    return !!(
      ctx.isGitHubActions &&
      ctx.token &&
      ctx.repoOwner &&
      ctx.repoName &&
      ctx.prNumber
    );
  }

  /** #1: Derive release tag targets from version diffs when tags were not created */
  private deriveReleaseTargets(diffs: VersionDiffResult[]): string[] {
    return diffs
      .filter((d) => d.diffType !== null)
      .map((d) => `${d.package.packageName}@${d.package.newVersion}`);
  }

  /** Auto-detect whether any changed package version is a prerelease (e.g. 1.0.0-beta.1) */
  private detectPrerelease(diffs: VersionDiffResult[]): boolean {
    for (const diff of diffs) {
      if (diff.diffType === null) continue;
      const prerelease = semver.prerelease(diff.package.newVersion);
      if (prerelease && prerelease.length > 0) {
        console.log(`[CiRunner] Detected prerelease version: ${diff.package.newVersion}`);
        return true;
      }
    }
    return false;
  }

  /** Auto-detect GitHub repo URL from git remote, falling back to GithubContext */
  private async detectRepoUrl(): Promise<string | undefined> {
    // Try Git remote first (works everywhere, not just CI)
    try {
      const git = new GitReader(this.cwd);
      const remoteUrl = await git.getRemoteUrl();
      if (remoteUrl) {
        // Convert git@github.com:owner/repo.git → https://github.com/owner/repo
        const httpsUrl = remoteUrl
          .replace(/^git@github\.com:/, 'https://github.com/')
          .replace(/\.git$/, '');
        if (httpsUrl.startsWith('https://github.com/')) {
          console.log(`[CiRunner] Detected repo URL from git remote: ${httpsUrl}`);
          return httpsUrl;
        }
      }
    } catch {
      // Fall through to context detection
    }

    // Fallback: construct from GitHub Actions context
    const ctx = new GithubContextDetector().detect();
    if (ctx.repoOwner && ctx.repoName) {
      const url = `https://github.com/${ctx.repoOwner}/${ctx.repoName}`;
      console.log(`[CiRunner] Detected repo URL from GitHub context: ${url}`);
      return url;
    }

    console.log('[CiRunner] Could not auto-detect repo URL (PR links will be plain text)');
    return undefined;
  }
}

export interface CiRunResult {
  success: boolean;
  /** Whether any version changes were detected */
  changed: boolean;
  versionDiffs: VersionDiffResult[];
  entryCount: number;
  markdown: string;
  dryRun: boolean;
}
