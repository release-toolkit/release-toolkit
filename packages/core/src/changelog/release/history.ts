import * as fs from 'node:fs';
import * as path from 'node:path';
import { VersionDiffResult } from '../../types.js';
import { CONFIG_DIR } from '../../config/index.js';
import { DIFF_TYPE_LABELS } from '../../constants.js';

/** Directory for release-level changelog summaries */
export const RELEASE_HISTORY_DIR = 'changelog/releases';

/**
 * Save a release summary as Markdown to `.releasetoolkit/changelog/YYYY-MM-DD_version.md`
 */
export function saveReleaseSummary(
  cwd: string,
  options: {
    version: string;
    date: string;
    versionDiffs: VersionDiffResult[];
    tagsCreated: string[];
    releaseUrl?: string;
    dryRun: boolean;
    markdown: string;
  },
): string {
  const historyDir = path.join(cwd, CONFIG_DIR, RELEASE_HISTORY_DIR);
  fs.mkdirSync(historyDir, { recursive: true });

  const datePart = new Date(options.date).toISOString().slice(0, 10);
  const versionPart = sanitizeFilename(options.version);
  const baseName = `${datePart}_${versionPart}`;

  const mdContent = renderMarkdownSummary(options);
  const mdPath = path.join(historyDir, `${baseName}.md`);
  fs.writeFileSync(mdPath, mdContent + '\n', 'utf-8');

  return mdPath;
}

/**
 * List all saved release changelog files, sorted by name descending.
 */
export function listReleaseSummaries(cwd: string): string[] {
  const historyDir = path.join(cwd, CONFIG_DIR, RELEASE_HISTORY_DIR);
  if (!fs.existsSync(historyDir)) return [];

  return fs.readdirSync(historyDir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}_/.test(f) && f.endsWith('.md'))
    .sort()
    .reverse();
}

// ============================================================
// Private helpers
// ============================================================

function renderMarkdownSummary(options: {
  version: string;
  date: string;
  versionDiffs: VersionDiffResult[];
  tagsCreated: string[];
  releaseUrl?: string;
  dryRun: boolean;
  markdown: string;
}): string {
  const lines: string[] = [];
  const changedPackages = options.versionDiffs.filter((d) => d.diffType !== null);

  // Header
  lines.push(`# ${options.version}`);
  lines.push('');
  lines.push(`> **Date:** ${new Date(options.date).toLocaleString('zh-CN', { timeZone: 'UTC' })}`);
  if (options.releaseUrl) {
    lines.push(`> **Release:** [${options.releaseUrl}](${options.releaseUrl})`);
  }
  lines.push('');

  // Packages table
  if (changedPackages.length > 0) {
    lines.push('## Packages');
    lines.push('');
    lines.push('| Package | Version | Type |');
    lines.push('|---------|---------|------|');
    for (const pkg of changedPackages) {
      const label = DIFF_TYPE_LABELS[pkg.diffType!];
      const typeLabel = label ? `${label.emoji} ${label.label}` : pkg.diffType!;
      lines.push(`| \`${pkg.package.packageName}\` | \`${pkg.package.currentVersion}\` → \`${pkg.package.newVersion}\` | ${typeLabel} |`);
    }
    lines.push('');
  }

  // Changelog body
  if (options.markdown) {
    lines.push('## Changelog');
    lines.push('');
    lines.push(options.markdown.trim());
    lines.push('');
  }

  // Footer metadata
  if (options.tagsCreated.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push(`**Tags:** ${options.tagsCreated.map((t) => `\`${t}\``).join(', ')}`);
  }
  if (options.dryRun) {
    lines.push('');
    lines.push('> ⚠️ This was a dry run.');
  }

  return lines.join('\n');
}

/** Remove characters unsafe for filenames */
function sanitizeFilename(version: string): string {
  return version.replace(/[/\\?%*:|"<>@]/g, '_');
}
