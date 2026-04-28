import type { PRChangelogData } from './types.js';
import { extractReleaseLog } from './comment-parser.js';

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
    // Empty PR — still write something meaningful
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
