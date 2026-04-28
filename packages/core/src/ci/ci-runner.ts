import { CiRunnerOptions, VersionDiffResult } from '../types.js';
import * as semver from 'semver';
import { PackageScanner } from '../version/version-diff-detector.js';
import {
  ChangelogCollector,
  ChangelogRenderer,
  saveReleaseSummary,
  consumeAllSnapshots,
  collectEntriesFromSnapshots,
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
import { DEFAULT_BASE_REF, DEFAULT_PLUGINS, DIFF_TYPE_LABELS } from '../constants.js';

export class CiRunner {
  private options: Required<CiRunnerOptions>;
  private cwd: string;

  constructor(options: Partial<CiRunnerOptions> = {}, cwd: string = process.cwd()) {
    this.cwd = cwd;
    // Load with 3-level merge: defaults ← config file ← explicit options
    this.options = loadConfig(cwd, options);
  }

  /**
   * Stage 3: Run after PR is merged to base branch.
   *
   * - Consume all saved PR changelog snapshots
   * - Build unified Release Changelog
   * - Write per-package CHANGELOG.md
   * - Create git tags
   * - Create GitHub Releases
   * - Update PR comment to mark as published
   */
  async run(): Promise<CiRunResult> {
    const startTime = Date.now();
    let success = true;
    const errors: string[] = [];

    console.log('=== Release Tool CI Runner (Stage 3) ===');
    console.log(`[CiRunner] Base ref: ${this.options.baseRef}`);
    console.log(`[CiRunner] Dry run: ${this.options.dryRun}`);

    // ── Step 0: Detect GitHub environment ─────────
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

    // ── Step 1: Detect version changes ────────────
    console.log('\n[CiRunner] Step 1: Detecting version changes...');
    const packageScanner = new PackageScanner(this.cwd);
    const versionDiffs = await packageScanner.detectVersionDiffs(this.options.baseRef);

    if (versionDiffs.length > 0) {
      console.log(PackageScanner.formatReport(versionDiffs));
    } else {
      console.log('[CiRunner] No version changes detected');
    }

    // ── Step 2: Consume all PR changelog snapshots ──
    console.log('\n[CiRunner] Step 2: Consuming PR changelog snapshots...');
    const snapshots = consumeAllSnapshots(this.cwd);

    if (snapshots.length === 0) {
      console.log('[CiRunner] No PR changelog snapshots found.');
    } else {
      console.log(`[CiRunner] Loaded ${snapshots.length} PR snapshot(s)`);
    }

    // ── Step 3: Build unified Release Changelog ────
    console.log('\n[CiRunner] Step 3: Building unified Release Changelog...');

    // 3a. Collect structured entries from snapshots
    const rawEntries = collectEntriesFromSnapshots(snapshots);

    // 3b. Load plugins and run Pipeline
    const pluginManager = new PluginManager(this.cwd);
    for (const name of this.options.plugins) {
      await pluginManager.loadByName(name);
    }
    console.log(`[CiRunner] Loaded plugins: [${pluginManager.getRegisteredNames().join(', ')}]`);

    const pipeline = new Pipeline(pluginManager);
    const version = this.extractNewVersion(versionDiffs);
    const output = await pipeline.run(rawEntries, version);

    // 3c. Render to Markdown via slim Renderer
    const repoUrl = await this.detectRepoUrl();
    const renderer = new ChangelogRenderer({ repoUrl });
    const markdown = renderer.renderMarkdown(output);

    console.log(
      `\n[CiRunner] Generated changelog:\n${'='.repeat(50)}\n${markdown}\n${'='.repeat(50)}`,
    );

    const changed = versionDiffs.some((d) => d.diffType !== null) || snapshots.length > 0;

    // ── Step 4: Write per-package CHANGELOG.md ─────
    console.log('\n[CiRunner] Step 4: Writing per-package CHANGELOG.md...');
    if (!this.options.dryRun) {
      try {
        await this.writePerPackageChangelogs(versionDiffs, markdown);
      } catch (error) {
        errors.push(`Failed to write package changelogs: ${error instanceof Error ? error.message : String(error)}`);
        success = false;
        console.error('[CiRunner] Failed to write package changelogs:', error);
      }
    } else {
      console.log('[CiRunner] [DRY-RUN] Would write per-package CHANGELOG.md');
    }

    // ── Step 5: Create git tags ──────────────────
    let createdTags: string[] = [];
    if (this.options.createTags && versionDiffs.length > 0) {
      console.log('\n[CiRunner] Step 5: Creating git tags...');
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

    // ── Step 6: Create GitHub Releases ────────────
    const releaseTargets = createdTags.length > 0
      ? createdTags
      : this.deriveReleaseTargets(versionDiffs);
    const isPrerelease = this.detectPrerelease(versionDiffs)

    if (this.options.createRelease && releaseTargets.length > 0) {
      console.log(`\n[CiRunner] Step 6: Creating GitHub Releases${isPrerelease ? ' (prerelease)' : ''}...`);
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

    // ── Step 7: Update PR comment (mark as published) ─
    if (!this.shouldPostComment(githubCtx)) {
      if (this.options.commentPr) {
        console.log('\n[CiRunner] Skipping PR comment (not in GitHub Actions or missing credentials)');
      }
    } else {
      try {
        console.log('\n[CiRunner] Step 7: Updating PR comment (mark as published)...');
        const commentBody = this.buildPublishedCommentBody(versionDiffs, markdown, createdTags);
        const poster = new PRCommentPoster(
          githubCtx.repoOwner!,
          githubCtx.repoName!,
          githubCtx.token!,
        );
        await poster.postComment(githubCtx.prNumber!, commentBody);
        console.log('[CiRunner] PR comment updated successfully');
      } catch (error) {
        errors.push(`Failed to update PR comment: ${error instanceof Error ? error.message : String(error)}`);
        success = false;
        console.error('[CiRunner] Failed to update PR comment:', error);
      }
    }

    // ── Step 8: Save release summary ─────────────
    if (changed && !this.options.dryRun) {
      try {
        const savedPath = saveReleaseSummary(this.cwd, {
          version: this.extractNewVersion(versionDiffs),
          date: new Date().toISOString(),
          versionDiffs,
          tagsCreated: createdTags,
          dryRun: this.options.dryRun,
          markdown,
        });
        console.log(`[CiRunner] Release summary saved: ${savedPath}`);
      } catch (error) {
        console.warn('[CiRunner] Failed to save release summary:', error);
      }
    }

    // ── Finalize ─────────────────────────────────
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n[CiRunner] Done! (${duration}s)`);

    if (errors.length > 0) {
      console.warn('[CiRunner] Errors encountered:');
      for (const e of errors) {
        console.warn(`  - ${e}`);
      }
    }

    return {
      success: success && errors.length === 0,
      changed,
      versionDiffs,
      entryCount: snapshots.length,
      markdown,
      dryRun: this.options.dryRun,
    };
  }

  // ============================================================
  // Private: Write per-package CHANGELOG.md
  // ============================================================

  private async writePerPackageChangelogs(
    versionDiffs: VersionDiffResult[],
    markdown: string,
  ): Promise<void> {
    const outputter = new FileOutputter();
    const changedPackages = versionDiffs.filter((d) => d.diffType !== null);

    if (changedPackages.length === 0) {
      console.log('[CiRunner] No package changes — skipping per-package CHANGELOG.md');
      return;
    }

    for (const diff of changedPackages) {
      const pkg = diff.package;
      const packageChangelogPath = `${pkg.packagePath}/CHANGELOG.md`;

      console.log(`[CiRunner] Writing ${packageChangelogPath}...`);

      outputter.write({
        filePath: packageChangelogPath,
        content: markdown,
        mode: this.options.fileWriteMode,
      });
    }
  }

  // ============================================================
  // Private: Comment Body Builder
  // ============================================================

  private buildPublishedCommentBody(
    versionDiffs: VersionDiffResult[],
    markdown: string,
    createdTags: string[],
  ): string {
    const lines: string[] = [];

    lines.push('## ✅ Release Published');
    lines.push('');
    lines.push(`**Version:** \`${this.extractNewVersion(versionDiffs)}\` | **Date:** \`${new Date().toISOString().split('T')[0]}\``);
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

  // ============================================================
  // Private Helpers
  // ============================================================

  private extractNewVersion(diffs: VersionDiffResult[]): string {
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

  private deriveReleaseTargets(diffs: VersionDiffResult[]): string[] {
    return diffs
      .filter((d) => d.diffType !== null)
      .map((d) => `${d.package.packageName}@${d.package.newVersion}`);
  }

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

  private async detectRepoUrl(): Promise<string | undefined> {
    try {
      const git = new GitReader(this.cwd);
      const remoteUrl = await git.getRemoteUrl();
      if (remoteUrl) {
        const httpsUrl = remoteUrl
          .replace(/^git@github\.com:/, 'https://github.com/')
          .replace(/\.git$/, '');
        if (httpsUrl.startsWith('https://github.com/')) {
          console.log(`[CiRunner] Detected repo URL from git remote: ${httpsUrl}`);
          return httpsUrl;
        }
      }
    } catch {
      // Fall through
    }

    const ctx = new GithubContextDetector().detect();
    if (ctx.repoOwner && ctx.repoName) {
      const url = `https://github.com/${ctx.repoOwner}/${ctx.repoName}`;
      console.log(`[CiRunner] Detected repo URL from GitHub context: ${url}`);
      return url;
    }

    console.log('[CiRunner] Could not auto-detect repo URL (PR links will be plain text)');
    return undefined;
  }

  private shouldPostComment(ctx: import('../types.js').GithubContext): boolean {
    if (!this.options.commentPr) return false;
    if (this.options.dryRun) {
      console.log(`[CiRunner] [DRY-RUN] Would post PR comment`);
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
}

// ── Public Result Type ─────────────────────────────

export interface CiRunResult {
  success: boolean;
  changed: boolean;
  versionDiffs: VersionDiffResult[];
  entryCount: number;
  markdown: string;
  dryRun: boolean;
}
