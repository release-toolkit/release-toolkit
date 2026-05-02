/**
 * Stage3: Release Publisher
 *
 * Triggered when: PR is merged to main branch
 * What it does:
 *   1. Read release info from Stage2 (or detect version changes)
 *   2. Consume all saved PR changelog snapshots
 *   3. Build unified Release Changelog
 *   4. Write per-package CHANGELOG.md
 *   5. Create git tags
 *   6. Create GitHub Releases
 *   7. Execute afterRelease hooks
 *   8. Update PR comment to mark as published
 *
 * Architecture: Pure logic class, no CLI dependencies
 * Future: Can easily change execution order or add/remove steps
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PackageScanner } from '../version/version-diff-detector.js';
import {
  consumeAllSnapshots,
  collectEntriesFromSnapshots,
  ChangelogRenderer,
  saveReleaseSummary,
} from '../changelog/index.js';
import { PluginManager } from '../plugin/plugin-manager.js';
import { Pipeline } from '../plugin/pipeline.js';
import { GithubContextDetector } from '../output/github-context-detector.js';
import { PRCommentPoster } from '../output/pr-comment-poster.js';
import { FileOutputter } from '../output/file-outputter.js';
import { TagManager } from '../tag/tag-manager.js';
import { GithubReleaseCreator } from '../publish/github-release-creator.js';
import { GitReader } from '../git/git-reader.js';
import { loadConfig } from '../config/index.js';
import { DIFF_TYPE_LABELS } from '../constants.js';
import type {
  VersionDiffResult,
  CiRunnerOptions,
} from '../types.js';
import type { ConsumedSnapshot } from '../changelog/pr/snapshot-consumer.js';

export interface Stage3Options extends Partial<CiRunnerOptions> {
  /** Working directory (default: process.cwd()) */
  cwd?: string;
}

export interface Stage3Result {
  success: boolean;
  changed: boolean;
  versionDiffs: VersionDiffResult[];
  createdTags: string[];
  markdown: string;
  error?: string;
}

export class Stage3ReleasePublisher {
  private options: Required<CiRunnerOptions>;
  private cwd: string;

  constructor(options: Stage3Options = {}) {
    this.cwd = options.cwd || process.cwd();
    // Load with 3-level merge: defaults ← config file ← explicit options
    this.options = loadConfig(this.cwd, options);
  }

  /**
   * Execute Stage3: Full CI pipeline
   */
  async run(): Promise<Stage3Result> {
    const startTime = Date.now();
    let success = true;
    const errors: string[] = [];

    console.log('=== Stage3: Release Publisher ===');
    console.log(`[Stage3] Base ref: ${this.options.baseRef}`);
    console.log(`[Stage3] Dry run: ${this.options.dryRun}\n`);

    try {
      // Step 0: Detect GitHub environment
      console.log('[Stage3] Step 0: Detecting environment...');
      const githubCtx = this.detectGitHubContext();

      // Step 1: Load release info from Stage2 (or detect version changes)
      console.log('\n[Stage3] Step 1: Loading release info...');
      const { versionDiffs, markdown: savedMarkdown } = await this.loadReleaseInfo();

      // Step 2: Consume all PR changelog snapshots
      console.log('\n[Stage3] Step 2: Consuming PR changelog snapshots...');
      const snapshots = this.consumeSnapshots();

      // Step 3: Build unified Release Changelog (use saved if available)
      console.log('\n[Stage3] Step 3: Building release changelog...');
      const markdown = savedMarkdown || await this.buildChangelog(snapshots);

      const changed = versionDiffs.some((d) => d.diffType !== null) || snapshots.length > 0;

      // Step 4: Write per-package CHANGELOG.md
      console.log('\n[Stage3] Step 4: Writing per-package CHANGELOG.md...');
      await this.writePackageChangelogs(versionDiffs, markdown, errors);

      // Step 5: Create git tags
      let createdTags: string[] = [];
      if (this.options.createTags && versionDiffs.length > 0) {
        console.log('\n[Stage3] Step 5: Creating git tags...');
        createdTags = await this.createTags(versionDiffs, errors);
      }

      // Step 6: Create GitHub Releases
      if (this.options.createRelease && createdTags.length > 0) {
        console.log('\n[Stage3] Step 6: Creating GitHub Releases...');
        await this.createReleases(createdTags, markdown, errors);
      }

      // Step 7: Update PR comment (mark as published)
      if (this.shouldUpdateComment(githubCtx)) {
        console.log('\n[Stage3] Step 7: Updating PR comment...');
        await this.updatePRComment(versionDiffs, markdown, createdTags, githubCtx, errors);
      }

      // Step 8: Save release summary
      if (changed && !this.options.dryRun) {
        console.log('\n[Stage3] Step 8: Saving release summary...');
        this.saveSummary(versionDiffs, markdown, createdTags);
      }

      // Finalize
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`\n[Stage3] Done! (${duration}s)`);

      if (errors.length > 0) {
        console.warn('[Stage3] Errors encountered:');
        for (const e of errors) {
          console.warn(`  - ${e}`);
        }
        success = false;
      }

      return {
        success: success && errors.length === 0,
        changed,
        versionDiffs,
        createdTags,
        markdown,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Stage3] ✗ Fatal error:`, errorMsg);

      return {
        success: false,
        changed: false,
        versionDiffs: [],
        createdTags: [],
        markdown: '',
        error: errorMsg,
      };
    }
  }

  // ============================================================
  // Steps (Private Methods)
  // ============================================================

  /**
   * Step 0: Detect GitHub context
   */
  private detectGitHubContext() {
    const detector = new GithubContextDetector();
    const ctx = detector.detect();

    if (ctx.isGitHubActions) {
      console.log(`[Stage3] Running in GitHub Actions - ${ctx.eventName} #${ctx.prNumber || '?'}`);
      if (ctx.baseRef) {
        this.options.baseRef = ctx.baseRef;
        console.log(`[Stage3] Using context baseRef: ${this.options.baseRef}`);
      }
    }

    return ctx;
  }

  /**
   * Step 1: Load release info from Stage2 (or detect version changes)
   */
  private async loadReleaseInfo(): Promise<{ versionDiffs: VersionDiffResult[]; markdown: string | null }> {
    const releaseInfoPath = path.join(this.cwd, '.releasetoolkit', 'release', 'info.json');

    // Try to load saved release info from Stage2
    if (fs.existsSync(releaseInfoPath)) {
      console.log('[Stage3] ✓ Found release info from Stage2');
      const releaseInfo = JSON.parse(fs.readFileSync(releaseInfoPath, 'utf-8'));

      // Convert saved data to VersionDiffResult format
      const versionDiffs: VersionDiffResult[] = releaseInfo.versionDiffs.map((v: {
        packageName: string;
        packagePath: string;
        currentVersion: string;
        newVersion: string;
        diffType: string;
      }) => ({
        package: {
          packageName: v.packageName,
          packagePath: v.packagePath,
          currentVersion: v.currentVersion,
          newVersion: v.newVersion,
        },
        diffType: v.diffType,
      }));

      console.log(`[Stage3] Loaded ${versionDiffs.length} version diffs`);
      return { versionDiffs, markdown: releaseInfo.markdown };
    }

    // Fallback: detect version changes
    console.log('[Stage3] No saved release info, detecting version changes...');
    const scanner = new PackageScanner(this.cwd);
    const diffs = await scanner.detectVersionDiffs(this.options.baseRef);

    if (diffs.length > 0) {
      console.log(PackageScanner.formatReport(diffs));
    } else {
      console.log('[Stage3] No version changes detected.');
    }

    return { versionDiffs: diffs, markdown: null };
  }

  /**
   * Step 2: Consume all PR changelog snapshots
   */
  private consumeSnapshots(): ConsumedSnapshot[] {
    const snapshots = consumeAllSnapshots(this.cwd);

    if (snapshots.length === 0) {
      console.log('[Stage3] No PR changelog snapshots found.');
    } else {
      console.log(`[Stage3] ✓ Loaded ${snapshots.length} PR snapshot(s)`);
    }

    return snapshots;
  }

  /**
   * Step 3: Build unified release changelog
   */
  private async buildChangelog(snapshots: ConsumedSnapshot[]): Promise<string> {
    // 3a. Collect structured entries
    const rawEntries = collectEntriesFromSnapshots(snapshots);

    // 3b. Load plugins and run Pipeline
    const pluginManager = new PluginManager(this.cwd);
    for (const name of this.options.plugins) {
      await pluginManager.loadByName(name);
    }
    console.log(`[Stage3] Loaded plugins: [${pluginManager.getRegisteredNames().join(', ')}]`);

    const pipeline = new Pipeline(pluginManager);
    const version = this.extractVersion(snapshots);
    const output = await pipeline.run(rawEntries, version);

    // 3c. Render to Markdown
    const repoUrl = await this.detectRepoUrl();
    const renderer = new ChangelogRenderer({ repoUrl });
    const markdown = renderer.renderMarkdown(output);

    console.log(`\n[Stage3] Generated changelog:\n${'='.repeat(50)}\n${markdown}\n${'='.repeat(50)}`);

    return markdown;
  }

  /**
   * Step 4: Write per-package CHANGELOG.md
   */
  private async writePackageChangelogs(
    versionDiffs: VersionDiffResult[],
    markdown: string,
    errors: string[],
  ): Promise<void> {
    const outputter = new FileOutputter();
    const changedPackages = versionDiffs.filter((d) => d.diffType !== null);

    if (changedPackages.length === 0) {
      console.log('[Stage3] No package changes — skipping per-package CHANGELOG.md');
      return;
    }

    if (this.options.dryRun) {
      console.log('[Stage3] [DRY-RUN] Would write per-package CHANGELOG.md');
      return;
    }

    try {
      for (const diff of changedPackages) {
        const pkg = diff.package;
        const packageChangelogPath = `${pkg.packagePath}/CHANGELOG.md`;

        console.log(`[Stage3] Writing ${packageChangelogPath}...`);

        outputter.write({
          filePath: packageChangelogPath,
          content: markdown,
          mode: this.options.fileWriteMode,
        });
      }
    } catch (error) {
      const errorMsg = `Failed to write package changelogs: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`[Stage3] ✗ ${errorMsg}`);
    }
  }

  /**
   * Step 5: Create git tags
   */
  private async createTags(
    versionDiffs: VersionDiffResult[],
    errors: string[],
  ): Promise<string[]> {
    try {
      const tagManager = new TagManager({ cwd: this.cwd, dryRun: this.options.dryRun });
      const tagResults = await tagManager.createAndPushTagsForDiffs(versionDiffs);
      const createdTags = tagResults.filter((r) => r.created || this.options.dryRun).map((r) => r.tagName);

      if (createdTags.length > 0) {
        console.log(`[Stage3] ✓ Created tags: [${createdTags.join(', ')}]`);
      } else {
        console.log('[Stage3] No tags created.');
      }

      return createdTags;
    } catch (error) {
      const errorMsg = `Failed to create tags: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`[Stage3] ✗ ${errorMsg}`);
      return [];
    }
  }

  /**
   * Step 6: Create GitHub Releases
   */
  private async createReleases(
    tags: string[],
    markdown: string,
    errors: string[],
  ): Promise<void> {
    try {
      const isPrerelease = this.detectPrerelease();

      const releaseCreator = new GithubReleaseCreator({
        cwd: this.cwd,
        afterRelease: this.options.afterRelease,
        dryRun: this.options.dryRun,
        draft: false,
        prerelease: isPrerelease,
      });

      const releaseResults = await releaseCreator.createReleases(tags, markdown);
      const succeeded = releaseResults.filter((r) => r.success);
      const failed = releaseResults.filter((r) => !r.success);

      console.log(`[Stage3] Release results: ${succeeded.length} succeeded, ${failed.length} failed`);
      for (const r of succeeded) {
        console.log(`  ✓ ${r.tagName} → ${r.htmlUrl || '[DRY-RUN]'}`);
      }
      for (const r of failed) {
        console.log(`  ✗ ${r.tagName}`);
      }

      if (failed.length > 0) {
        errors.push(`${failed.length} release(s) failed`);
      }
    } catch (error) {
      const errorMsg = `Failed to create releases: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`[Stage3] ✗ ${errorMsg}`);
    }
  }

  /**
   * Step 7: Update PR comment
   */
  private async updatePRComment(
    versionDiffs: VersionDiffResult[],
    markdown: string,
    createdTags: string[],
    githubCtx: import('../types.js').GithubContext,
    errors: string[],
  ): Promise<void> {
    try {
      const commentBody = this.buildPublishedCommentBody(versionDiffs, markdown, createdTags);
      const poster = new PRCommentPoster(
        githubCtx.repoOwner!,
        githubCtx.repoName!,
        githubCtx.token!,
      );
      await poster.postComment(githubCtx.prNumber!, commentBody);
      console.log('[Stage3] ✓ PR comment updated successfully');
    } catch (error) {
      const errorMsg = `Failed to update PR comment: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      console.error(`[Stage3] ✗ ${errorMsg}`);
    }
  }

  /**
   * Step 8: Save release summary
   */
  private saveSummary(
    versionDiffs: VersionDiffResult[],
    markdown: string,
    createdTags: string[],
  ): void {
    try {
      const savedPath = saveReleaseSummary(this.cwd, {
        version: this.extractVersion([]),
        date: new Date().toISOString(),
        versionDiffs,
        tagsCreated: createdTags,
        dryRun: this.options.dryRun,
        markdown,
      });
      console.log(`[Stage3] ✓ Release summary saved: ${savedPath}`);
    } catch (error) {
      console.warn('[Stage3] ⚠ Failed to save release summary:', error);
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private extractVersion(_snapshots: ConsumedSnapshot[]): string {
    // Try to extract version from the first snapshot's data
    // For now, return 'unreleased' as default
    // TODO: Extract version from PRChangelogData or VersionDiffResult
    return 'unreleased';
  }

  private detectPrerelease(): boolean {
    // TODO: Implement proper prerelease detection
    return false;
  }

  private async detectRepoUrl(): Promise<string | undefined> {
    try {
      const git = new GitReader(this.cwd);
      const remoteUrl = await git.getRemoteUrl();
      if (remoteUrl) {
        const httpsUrl = remoteUrl
          .replace(/^git@github\.com:/, 'https://github.com/')
          .replace(/\.git$/, '');
        if (httpsUrl.startsWith('https://github.com/')) {
          return httpsUrl;
        }
      }
    } catch {
      // Fall through
    }

    const ctx = new GithubContextDetector().detect();
    if (ctx.repoOwner && ctx.repoName) {
      return `https://github.com/${ctx.repoOwner}/${ctx.repoName}`;
    }

    return undefined;
  }

  private shouldUpdateComment(ctx: import('../types.js').GithubContext): boolean {
    if (!this.options.commentPr) return false;
    if (this.options.dryRun) {
      console.log('[Stage3] [DRY-RUN] Would update PR comment');
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

  private buildPublishedCommentBody(
    versionDiffs: VersionDiffResult[],
    markdown: string,
    createdTags: string[],
  ): string {
    const lines: string[] = [];

    lines.push('## ✅ Release Published');
    lines.push('');
    lines.push(`**Date:** \`${new Date().toISOString().split('T')[0]}\``);
    lines.push('');

    if (createdTags.length > 0) {
      lines.push('**Tags created:**');
      for (const tag of createdTags) {
        lines.push(`  - \`${tag}\``);
      }
      lines.push('');
    }

    const changed = versionDiffs.filter((d) => d.diffType !== null);
    if (changed.length > 0) {
      lines.push('### 📦 Released Versions:');
      lines.push('| Package | Old | New | Type |');
      lines.push('|---------|-----|-----|------|');

      for (const diff of changed) {
        const label = DIFF_TYPE_LABELS[diff.diffType!];
        lines.push(
          `| \`${diff.package.packageName}\` | \`${diff.package.currentVersion}\` | \`${diff.package.newVersion}\` | ${label ? `${label.emoji} ${label.label}` : diff.diffType!} |`,
        );
      }
      lines.push('');
    }

    lines.push('### 📝 Changelog:');
    lines.push(markdown);

    return lines.join('\n');
  }
}
