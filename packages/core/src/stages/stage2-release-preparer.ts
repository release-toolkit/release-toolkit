/**
 * Stage2: Release Preparer
 *
 * Triggered when: PR is merged to dev branch
 * Architecture: Pure logic class, no CLI dependencies
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { PackageScanner } from '../version/version-diff-detector.js';
import {
  consumeAllSnapshots,
  collectEntriesFromSnapshots,
  ChangelogRenderer,
} from '../changelog/index.js';
import { PluginManager } from '../plugin/plugin-manager.js';
import { Pipeline } from '../plugin/pipeline.js';
import type { VersionDiffResult, ConsumedSnapshot } from '../changelog/index.js';

export interface Stage2Options {
  /** Base branch to compare against (default: 'main') */
  baseRef?: string;
  /** Development branch (default: 'dev') */
  devBranch?: string;
  /** Plugin names to apply (default: ['emoji-prefix', 'category-group', 'markdown-bold']) */
  plugins?: string[];
  /** Working directory (default: process.cwd()) */
  cwd?: string;
  /** Save release info to disk (default: true) */
  save?: boolean;
}

export interface Stage2Result {
  success: boolean;
  versionDiffs: VersionDiffResult[];
  changedPackages: string[];
  markdown: string;
  snapshotCount: number;
  savedPath?: string;
  error?: string;
}

export class Stage2ReleasePreparer {
  private options: Required<Stage2Options>;

  constructor(options: Stage2Options = {}) {
    this.options = {
      baseRef: 'main',
      devBranch: 'dev',
      plugins: ['emoji-prefix', 'category-group', 'markdown-bold'],
      cwd: process.cwd(),
      save: true,
      ...options,
    };
  }

  /**
   * Execute Stage2: Detect version changes and prepare release info
   */
  async run(): Promise<Stage2Result> {
    console.log('\n[Stage2] Starting release preparation...');
    console.log(`[Stage2] Base ref: ${this.options.baseRef}`);
    console.log(`[Stage2] Dev branch: ${this.options.devBranch}\n`);

    try {
      // Step1: Detect version changes
      console.log('[Stage2] Step 1: Detecting version changes...');
      const versionDiffs = await this.detectVersionChanges();

      // Step2: Check if any packages changed
      const changedPackages = this.getChangedPackages(versionDiffs);

      if (changedPackages.length === 0) {
        console.log('[Stage2] No version changes detected. Skipping release preparation.\n');
        return {
          success: true,
          versionDiffs,
          changedPackages: [],
          markdown: '',
          snapshotCount: 0,
        };
      }

      console.log(`[Stage2] Detected changes in ${changedPackages.length} package(s):`);
      for (const pkg of changedPackages) {
        console.log(`  - ${pkg}`);
      }
      console.log();

      // Step3: Consume all PR changelog snapshots
      console.log('[Stage2] Step 2: Consuming PR changelog snapshots...');
      const snapshots = this.consumeSnapshots();
      console.log(`[Stage2] Loaded ${snapshots.length} PR snapshot(s)\n`);

      // Step4: Build unified release changelog
      console.log('[Stage2] Step 3: Building release changelog...');
      const markdown = await this.buildChangelog(snapshots);

      console.log(`[Stage2] Release preparation completed\n`);
      console.log('='.repeat(50));
      console.log(markdown);
      console.log('='.repeat(50) + '\n');

      // Step5: Save release info for Stage3
      let savedPath: string | undefined;
      if (this.options.save) {
        console.log('[Stage2] Step 4: Saving release info...');
        savedPath = this.saveReleaseInfo(versionDiffs, markdown);
      }

      return {
        success: true,
        versionDiffs,
        changedPackages,
        markdown,
        snapshotCount: snapshots.length,
        savedPath,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Stage2] Failed:`, errorMsg);

      return {
        success: false,
        versionDiffs: [],
        changedPackages: [],
        markdown: '',
        snapshotCount: 0,
        error: errorMsg,
      };
    }
  }

  /**
   * Step 1: Detect version changes in packages
   */
  private async detectVersionChanges(): Promise<VersionDiffResult[]> {
    const { cwd, baseRef } = this.options;
    const scanner = new PackageScanner(cwd);
    const diffs = await scanner.detectVersionDiffs(baseRef);

    if (diffs.length > 0) {
      console.log(PackageScanner.formatReport(diffs));
    } else {
      console.log('[Stage2] No package.json files changed.');
    }

    return diffs;
  }

  /**
   * Get list of changed package names
   */
  private getChangedPackages(diffs: VersionDiffResult[]): string[] {
    return diffs
      .filter((d) => d.diffType !== null)
      .map((d) => d.package.packageName);
  }

  /**
   * Step 2: Consume all PR changelog snapshots
   */
  private consumeSnapshots(): ConsumedSnapshot[] {
    const { cwd } = this.options;
    return consumeAllSnapshots(cwd);
  }

  /**
   * Step 3: Build unified release changelog
   */
  private async buildChangelog(snapshots: ConsumedSnapshot[]): Promise<string> {
    // 3a. Collect structured entries
    const rawEntries = collectEntriesFromSnapshots(snapshots);

    // 3b. Load plugins and run Pipeline
    const pluginManager = new PluginManager(this.options.cwd);
    for (const name of this.options.plugins) {
      await pluginManager.loadByName(name);
    }
    console.log(`[Stage2] Loaded plugins: [${pluginManager.getRegisteredNames().join(', ')}]`);

    const pipeline = new Pipeline(pluginManager);
    const version = this.extractVersion(snapshots);
    const output = await pipeline.run(rawEntries, version);

    // 3c. Render to Markdown
    const renderer = new ChangelogRenderer();
    const markdown = renderer.renderMarkdown(output);

    return markdown;
  }

  /**
   * Step 4: Save release info for Stage3 to consume
   */
  private saveReleaseInfo(versionDiffs: VersionDiffResult[], markdown: string): string {
    const { cwd } = this.options;
    const releaseDir = path.join(cwd, '.releasetoolkit', 'release');
    const releaseFile = path.join(releaseDir, 'info.json');

    // Ensure directory exists
    fs.mkdirSync(releaseDir, { recursive: true });

    // Build release info
    const releaseInfo = {
      timestamp: new Date().toISOString(),
      version: this.extractVersion([]),
      versionDiffs: versionDiffs.map((d) => ({
        packageName: d.package.packageName,
        packagePath: d.package.packagePath,
        currentVersion: d.package.currentVersion,
        newVersion: d.package.newVersion,
        diffType: d.diffType,
      })),
      markdown,
    };

    // Save to disk
    fs.writeFileSync(releaseFile, JSON.stringify(releaseInfo, null, 2) + '\n', 'utf-8');

    const relPath = releaseFile.replace(cwd + '/', '');
    console.log(`[Stage2] Release info saved: ${relPath}`);

    return releaseFile;
  }

  /**
   * Extract version from version diffs
   */
  private extractVersion(versionDiffs: VersionDiffResult[]): string {
    // Priority: major > minor > patch
    const priority: Record<string, number> = { major: 3, minor: 2, patch: 1 };
    let best: VersionDiffResult | null = null;

    for (const diff of versionDiffs) {
      if (!diff.diffType) continue;
      if (!best || priority[diff.diffType] > priority[best.diffType!]) {
        best = diff;
      }
    }

    return best?.package.newVersion || 'unreleased';
  }
}
