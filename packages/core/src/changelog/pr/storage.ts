import * as path from 'node:path';
import * as fs from 'node:fs';
import { CONFIG_DIR } from '../../config/index.js';
import { PR_CHANGELOG_DIR } from './comment-parser.js';
import type { PRChangelogData } from './types.js';
import { renderPRChangelogMD } from './renderer.js';

// ============================================================
// Save / List
// ============================================================

export interface SavePRChangelogOptions {
  /**
   * Overwrite strategy when file already exists.
   * - `'overwrite'` (default): replace existing content
   * - `'skip'`: keep existing, return path without writing
   */
  overwrite?: 'overwrite' | 'skip';
}

/**
 * Save a PR changelog as Markdown to `.releasetoolkit/changelog/prs/pr-{number}_{date}.md`
 *
 * C4: Default is `overwrite`. Use `{ overwrite: 'skip' }` to preserve existing files
 * (e.g. when re-processing an already-recorded PR).
 */
export function savePRChangelog(
  cwd: string,
  data: PRChangelogData,
  options?: SavePRChangelogOptions,
): string | null {
  const prDir = path.join(cwd, CONFIG_DIR, PR_CHANGELOG_DIR);
  fs.mkdirSync(prDir, { recursive: true });

  const datePart = new Date(data.meta.createdAt).toISOString().slice(0, 10);
  const baseName = `pr-${data.meta.number}_${datePart}`;
  const mdPath = path.join(prDir, `${baseName}.md`);

  // Skip if file exists and mode is 'skip'
  if (options?.overwrite === 'skip' && fs.existsSync(mdPath)) {
    return mdPath;
  }

  fs.writeFileSync(mdPath, renderPRChangelogMD(data) + '\n', 'utf-8');

  return mdPath;
}

export function listPRChangeLogs(cwd: string): string[] {
  const prDir = path.join(cwd, CONFIG_DIR, PR_CHANGELOG_DIR);
  if (!fs.existsSync(prDir)) return [];

  return fs.readdirSync(prDir)
    .filter((f) => f.startsWith('pr-') && f.endsWith('.md'))
    .sort()
    .reverse();
}
