import { PackageVersionInfo, VersionDiffResult, DiffType } from '../types.js';
import { GitReader } from '../git/git-reader.js';
import * as semver from 'semver';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DIFF_TYPE_LABELS } from '../constants.js';

export class PackageScanner {
  private baseDir: string;
  private gitReader: GitReader;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    this.gitReader = new GitReader(baseDir);
  }

  /** Extract package name from package.json content */
  private extractPackageName(content: string): string {
    try {
      const pkg = JSON.parse(content);
      return pkg.name || '';
    } catch {
      return '';
    }
  }

  /** Extract version from package.json content */
  private extractVersion(content: string): string {
    try {
      const pkg = JSON.parse(content);
      return pkg.version || '';
    } catch {
      return '';
    }
  }

  /**
   * Scan changed package.json files and detect version differences.
   *
   * @param baseRef - Base branch/commit to compare against (e.g. 'main')
   * @returns Array of version diff results
   */
  async detectVersionDiffs(baseRef: string): Promise<VersionDiffResult[]> {
    // Get list of changed package.json files
    const changedFiles = await this.gitReader.diffFiles(baseRef, undefined, ['**/package.json']);

    if (changedFiles.length === 0) {
      console.log('[PackageScanner] No package.json files changed');
      return [];
    }

    const results: VersionDiffResult[] = [];

    for (const filePath of changedFiles) {
      // Read old version from base ref
      const oldContent = await this.gitReader.showFileContent(baseRef, filePath);

      // Read new version from working directory
      const absolutePath = resolve(this.baseDir, filePath);
      let newContent = '';
      if (existsSync(absolutePath)) {
        newContent = readFileSync(absolutePath, 'utf-8');
      }

      const oldVersion = this.extractVersion(oldContent);
      const newVersion = this.extractVersion(newContent);
      const packageName = this.extractPackageName(newContent || oldContent);

      if (!oldVersion && !newVersion) {
        continue; // Skip files without valid versions
      }

      const packageInfo: PackageVersionInfo = {
        packageName,
        packagePath: filePath,
        currentVersion: oldVersion,
        newVersion: newVersion,
      };

      // Use semver.diff to determine change type
      let diffType: DiffType = null;

      if (oldVersion && newVersion && oldVersion !== newVersion) {
        diffType = semver.diff(oldVersion, newVersion) as DiffType;
      } else if (!oldVersion && newVersion) {
        // New file added - treat as minor by convention
        diffType = 'minor';
      } else if (oldVersion && !newVersion) {
        // File removed - treat as major
        diffType = 'major';
      }
      // else unchanged

      results.push({
        package: packageInfo,
        diffType,
      });
    }

    return results;
  }

  /** Format version diff results for terminal display */
  static formatReport(results: VersionDiffResult[]): string {
    const lines: string[] = ['', '📦 Version Changes:', ''];

    if (results.length === 0) {
      lines.push('  No version changes detected.');
      lines.push('');
      return lines.join('\n');
    }

    const hasChanges = results.some((r) => r.diffType !== null);
    const unchanged = results.filter((r) => r.diffType === null);
    const changed = results.filter((r) => r.diffType !== null);

    if (changed.length > 0) {
      for (const result of changed) {
        const { package: pkg, diffType } = result;
        const label = DIFF_TYPE_LABELS[diffType!];
        lines.push(
          `  ${pkg.packageName.padEnd(25)} ${pkg.currentVersion} → ${pkg.newVersion.padEnd(12)} [${label ? `${label.emoji} ${label.label}` : diffType!}]`,
        );
      }
      lines.push('');
    }

    if (unchanged.length > 0) {
      lines.push('  Unchanged:');
      for (const result of unchanged) {
        const { package: pkg } = result;
        lines.push(
          `  ${pkg.packageName.padEnd(25)} ${pkg.currentVersion} → ${pkg.newVersion.padEnd(12)} ⚪ (unchanged)`,
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
