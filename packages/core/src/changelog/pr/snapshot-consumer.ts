import * as fs from 'node:fs';
import * as path from 'node:path';
import { CONFIG_DIR } from '../../config/index.js';
import { PR_CHANGELOG_DIR } from './comment-parser.js';
import type { PRChangelogData, CommitTitle } from './types.js';
import type { ChangeLogEntry, CommitType } from '../../types.js';

// ============================================================
// Snapshot Consumer — consume all PR snapshots and extract
// structured ChangeLogEntry[] for Pipeline processing
// ============================================================

export interface ConsumedSnapshot {
  prNumber: number;
  data: PRChangelogData;
  markdown: string;
}

/**
 * Read all saved PR changelog snapshots from disk.
 * Returns parsed snapshots sorted by PR number ascending.
 */
export function consumeAllSnapshots(cwd: string): ConsumedSnapshot[] {
  const prDir = path.join(cwd, CONFIG_DIR, PR_CHANGELOG_DIR);
  if (!fs.existsSync(prDir)) return [];

  const files = fs.readdirSync(prDir)
    .filter((f) => f.startsWith('pr-') && f.endsWith('.md'))
    .sort(); // alphabetical sort works for pr-N_date.md

  const snapshots: ConsumedSnapshot[] = [];

  for (const file of files) {
    const filePath = path.join(prDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // Extract PR number from filename: pr-{N}_{date}.md
    const match = file.match(/^pr-(\d+)_/);
    if (!match) continue;

    const prNumber = parseInt(match[1], 10);

    // Parse the markdown back into a structured shape
    const data = parsePRChangelogMD(content, prNumber);
    snapshots.push({ prNumber, data, markdown: content });
  }

  return snapshots.sort((a, b) => a.prNumber - b.prNumber);
}

/**
 * Parse a PR changelog markdown file back into PRChangelogData.
 *
 * Format written by `renderPRChangelogMD`:
 *   ---
 *   @pkg/a
 *   @pkg/b
 *   ---
 *
 *   commit subject 1
 *   commit subject 2
 *
 *   (extracted release log from comment)
 */
function parsePRChangelogMD(content: string, prNumber: number): PRChangelogData {
  const lines = content.split('\n');

  const packages: string[] = [];
  const entries: CommitTitle[] = [];
  let inFrontMatter = false;
  let frontMatterDone = false;

  for (const line of lines) {
    // Detect front-matter start
    if (line.trim() === '---' && !frontMatterDone) {
      inFrontMatter = !inFrontMatter;
      continue;
    }

    if (inFrontMatter) {
      // Package name line
      if (line.trim() && !line.startsWith('---')) {
        packages.push(line.trim());
      }
      continue;
    }

    frontMatterDone = true;

    // Skip empty lines between sections
    if (!line.trim()) continue;

    // Collect as entry (raw subject line)
    entries.push({ hash: '', subject: line.trim() });
  }

  return {
    meta: {
      number: prNumber,
      title: entries.length > 0 ? entries[0].subject : `PR #${prNumber}`,
      author: 'unknown',
      state: 'merged',
      labels: [],
      createdAt: new Date().toISOString(),
      baseRef: '',
      headRef: '',
    },
    packages,
    entries,
    related: {},
  };
}

/**
 * Infer commit type from a conventional-commit subject line.
 *
 * Examples:
 *   "feat: add feature"    → "feat"
 *   "fix(core): bug"       → "fix"
 *   "✨ feat: add feature"  → "feat" (emoji prefix tolerated)
 *   "random text"           → "chore" (fallback)
 */
function inferCommitType(subject: string): CommitType {
  // Strip leading emoji if present, then match conventional commit prefix
  const stripped = subject.replace(/^\p{Emoji_Presentation}\s*/u, '');
  const match = stripped.match(/^(\w+)(\([^)]+\))?:/);
  if (match) {
    const type = match[1].toLowerCase();
    const validTypes: CommitType[] = [
      'feat', 'fix', 'docs', 'style', 'refactor',
      'perf', 'test', 'build', 'ci', 'chore', 'revert',
    ];
    if (validTypes.includes(type as CommitType)) {
      return type as CommitType;
    }
  }
  return 'chore';
}

/**
 * Infer scope from a conventional-commit subject line.
 *
 * Examples:
 *   "feat(core): add feature"  → "core"
 *   "fix: bug"                 → undefined
 */
function inferScope(subject: string): string | undefined {
  const stripped = subject.replace(/^\p{Emoji_Presentation}\s*/u, '');
  const match = stripped.match(/^\w+\(([^)]+)\):/);
  return match ? match[1] : undefined;
}

/**
 * Extract structured ChangeLogEntry[] from all PR snapshots.
 *
 * This is the data-layer function — it produces raw entries for
 * Pipeline + PluginManager to format, and ChangelogRenderer to render.
 */
export function collectEntriesFromSnapshots(snapshots: ConsumedSnapshot[]): ChangeLogEntry[] {
  const entries: ChangeLogEntry[] = [];

  for (const snap of snapshots) {
    const { prNumber, data } = snap;

    for (const commit of data.entries) {
      entries.push({
        type: inferCommitType(commit.subject),
        scope: inferScope(commit.subject),
        subject: commit.subject,
        hash: commit.hash || undefined,
        prNumber: String(prNumber),
        packageName: data.packages.length > 0 ? data.packages.join(', ') : undefined,
      });
    }
  }

  return entries;
}
