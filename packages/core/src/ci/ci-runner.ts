import { CiRunnerOptions, VersionDiffResult } from '../types.js';
import { PackageScanner } from '../version/version-diff-detector.js';
import { ChangelogFileReader } from '../changelog/file-reader.js';
import { ChangelogCollector } from '../changelog/collector.js';
import { ChangelogRenderer } from '../changelog/renderer.js';
import { PluginManager } from '../plugin/plugin-manager.js';
import { Pipeline } from '../plugin/pipeline.js';
import { GithubContextDetector } from '../output/github-context-detector.js';
import { PRCommentPoster } from '../output/pr-comment-poster.js';
import { FileOutputter } from '../output/file-outputter.js';
import { DEFAULT_BASE_REF, DEFAULT_PLUGINS } from '../constants.js';

export class CiRunner {
  private options: Required<CiRunnerOptions>;
  private cwd: string;

  constructor(options: Partial<CiRunnerOptions>, cwd: string = process.cwd()) {
    this.cwd = cwd;
    this.options = {
      baseRef: options.baseRef || DEFAULT_BASE_REF,
      changelogDir: options.changelogDir || '.changelog',
      outputPath: options.outputPath || 'CHANGELOG.md',
      commentPr: options.commentPr ?? true,
      dryRun: options.dryRun ?? false,
      plugins: options.plugins || DEFAULT_PLUGINS,
      pluginOptions: options.pluginOptions || {},
    };
  }

  /** Run the complete CI pipeline */
  async run(): Promise<CiRunResult> {
    const startTime = Date.now();

    console.log('=== Release Tool CI Runner ===');
    console.log(`[CiRunner] Base ref: ${this.options.baseRef}`);
    console.log(`[CiRunner] Changelog dir: ${this.options.changelogDir}`);
    console.log(`[CiRunner] Output file: ${this.options.outputPath}`);
    console.log(`[CiRunner] Dry run: ${this.options.dryRun}`);

    // Step 1: Detect GitHub context
    const contextDetector = new GithubContextDetector();
    const githubCtx = contextDetector.detect();
    if (githubCtx.isGitHubActions) {
      console.log(
        `[CiRunner] Running in GitHub Actions - ${githubCtx.eventName} #${githubCtx.prNumber || '?'}`,
      );
      // Use context-provided base ref if available
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

    // Step 4: Setup plugin pipeline
    const pluginContext = { cwd: this.cwd, options: this.options.pluginOptions };
    const pluginManager = new PluginManager(pluginContext);

    // Load built-in plugins by name
    for (const pluginName of this.options.plugins) {
      try {
        await pluginManager.loadByName(pluginName);
      } catch (error) {
        console.warn(`[CiRunner] Could not load plugin "${pluginName}", skipping`);
      }
    }

    await pluginManager.initAll();
    console.log(`[CiRunner] Plugins loaded: [${pluginManager.getRegisteredNames().join(', ')}]`);

    // Step 5: Collect and deduplicate entries
    const collector = new ChangelogCollector();
    const collectedEntries = collector.collect([rawEntries]);

    // Step 6: Run pipeline
    const pipeline = new Pipeline(pluginManager);
    const version = this.extractNewVersion(versionDiffs);
    const output = await pipeline.run(collectedEntries, version);

    // Step 7: Render output
    const renderer = new ChangelogRenderer();
    const markdown = renderer.renderMarkdown(output);
    console.log(
      `\n[CiRunner] Generated changelog:\n${'='.repeat(50)}\n${markdown}\n${'='.repeat(50)}`,
    );

    // Step 8: Write file
    if (!this.options.dryRun) {
      const outputter = new FileOutputter();
      outputter.write({
        filePath: this.options.outputPath,
        content: markdown,
        mode: 'overwrite',
      });
    } else {
      console.log(`[CiRunner] [DRY-RUN] Would write to ${this.options.outputPath}`);
    }

    // Step 9: Post PR comment
    if (this.options.commentPr && !this.options.dryRun) {
      if (
        githubCtx.isGitHubActions &&
        githubCtx.token &&
        githubCtx.repoOwner &&
        githubCtx.repoName &&
        githubCtx.prNumber
      ) {
        console.log(`\n[CiRunner] Posting PR comment...`);
        const commentBody = this.buildCommentBody(output, versionDiffs, markdown);
        const poster = new PRCommentPoster(
          githubCtx.repoOwner,
          githubCtx.repoName,
          githubCtx.token,
        );
        await poster.postComment(githubCtx.prNumber, commentBody);
        console.log(`[CiRunner] PR comment posted successfully`);
      } else {
        console.log(
          `[CiRunner] Skipping PR comment (not in GitHub Actions or missing credentials)`,
        );
      }
    } else if (this.options.commentPr && this.options.dryRun) {
      console.log(`[CiRunner] [DRY-RUN] Would post PR comment`);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n[CiRunner] Done! (${duration}s)`);

    return {
      success: true,
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
          const labelMap: Record<string, string> = {
            major: '🔴 MAJOR',
            minor: '🟡 MINOR',
            patch: '🟢 PATCH',
          };
          lines.push(
            `| \`${diff.package.packageName}\` | \`${diff.package.currentVersion}\` | \`${diff.package.newVersion}\` | ${labelMap[diff.diffType!]} |`,
          );
        }
      }
    }

    lines.push('');
    lines.push('### 📝 Changelog:');
    lines.push(markdown);

    return lines.join('\n');
  }
}

export interface CiRunResult {
  success: boolean;
  versionDiffs: VersionDiffResult[];
  entryCount: number;
  markdown: string;
  dryRun: boolean;
}
