import * as path from 'node:path';
import * as fs from 'node:fs';
import { CONFIG_DIR } from '../config/index.js';
import type { PRChangelogData } from './pr-changelog-types.js';

// ============================================================
// Constants
// ============================================================

/** Directory for PR-level changelog files */
export const PR_CHANGELOG_DIR = 'changelog/prs';

/** Markers used in PR review comments to delimit release log content */
export const RELEASE_LOG_START = '<!-- RELEASE-LOG-START -->';
export const RELEASE_LOG_END = '<!-- RELEASE-LOG-END -->';

/** Marker for explicitly declaring affected packages in PR comment */
export const PACKAGES_MARKER = '<!-- PACKAGES:';  // e.g. <!-- PACKAGES: @pkg/a, @pkg/b -->

// ============================================================
// Render — Minimal Changeset-style Markdown
// ============================================================

/** Render PR changelog into minimal MD: packages + commits + extracted review note */
export function renderPRChangelogMD(data: PRChangelogData): string {
  const parts: string[] = [];

  // ── Package list (front-matter style) ──
  if (data.packages && data.packages.length > 0) {
    parts.push('---');
    for (const pkg of data.packages) {
      parts.push(pkg);
    }
    parts.push('---');
  }

  // ── Commit titles (raw, one per line) ──
  if (data.entries.length > 0) {
    parts.push('');
    for (const entry of data.entries) {
      parts.push(entry.subject);
    }
  } else {
    // C1: Empty PR — still write something meaningful
    parts.push('');
    parts.push(`(no commits — title change only: ${data.meta.title})`);
  }

  // ── Extracted release log from first comment ──
  if (data.related.reviewNote) {
    const extracted = extractReleaseLog(data.related.reviewNote.body);
    if (extracted) {
      parts.push('');
      parts.push(extracted);
    }
  }

  return parts.join('\n');
}

/**
 * Extract content between `<!-- RELEASE-LOG-START -->` and `<!-- RELEASE-LOG-END -->`
 * Returns null if markers not found.
 */
export function extractReleaseLog(commentBody: string): string | null {
  const startIdx = commentBody.indexOf(RELEASE_LOG_START);
  const endIdx = commentBody.indexOf(RELEASE_LOG_END);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;

  return commentBody
    .slice(startIdx + RELEASE_LOG_START.length, endIdx)
    .trim();
}

/**
 * Extract explicitly declared packages from PR first comment.
 * Format: `<!-- PACKAGES: @pkg/a, @pkg/b, @pkg/c -->`
 * Returns null if marker not found or content is empty.
 */
export function extractDeclaredPackages(commentBody: string): string[] | null {
  const idx = commentBody.indexOf(PACKAGES_MARKER);
  if (idx === -1) return null;

  const start = idx + PACKAGES_MARKER.length;
  const endIdx = commentBody.indexOf('-->', start);
  if (endIdx === -1) return null;

  const raw = commentBody.slice(start, endIdx).trim();
  if (!raw) return null;

  // Split by comma, trim whitespace, filter empty
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
}

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

  // C4: Skip if file exists and mode is 'skip'
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
