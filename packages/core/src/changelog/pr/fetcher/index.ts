import type { PRChangelogData, CommitTitle } from '../types.js';
import { extractReleaseLog, extractDeclaredPackages } from '../comment-parser.js';
import { loadPRChangelogConfig } from '../../../config/index.js';
import type { PRChangelogConfig } from '../../../config/index.js';
import { getPR, getCommits, getFirstReviewComment, getAllFiles } from './github-api.js';
import { resolvePackages } from './package-resolver.js';

export interface PRFetcherOptions {
  owner: string;
  repo: string;
  token: string;
  prNumber: number;
  /** Optional override for PR changelog config (loaded from file if omitted) */
  prConfig?: PRChangelogConfig;
}

/**
 * Fetch PR data from GitHub API and build PRChangelogData.
 * Uses octokit (dynamic import, optional dependency).
 *
 * B3/C2: listFiles supports pagination for PRs with >100 changed files.
 */
export async function fetchPRData(options: PRFetcherOptions): Promise<PRChangelogData> {
  const { Octokit } = await import('octokit');
  const octokit = new Octokit({ auth: options.token });

  // Load PR changelog config (use provided override or load from file)
  const prConfig = options.prConfig ?? loadPRChangelogConfig();

  const [pr, commits, comments, files] = await Promise.all([
    getPR(octokit, options),
    getCommits(octokit, options),
    getFirstReviewComment(octokit, options),
    // Paginated file listing
    getAllFiles(octokit, options),
  ]);

  // Map commits → CommitTitle[] (raw subjects)
  const entries = commits.map((c) => ({
    hash: c.sha.slice(0, 7),
    subject: extractSubject(c.commit?.message || ''),
  }));

  // Resolve affected packages (priority: comment declaration > diff inference > fallback)
  const packages = resolvePackages(pr, commits, files, comments, prConfig);

  // Extract release log from first review comment
  const reviewNote = comments.length > 0 ? {
    author: comments[0].user?.login || 'unknown',
    body: comments[0].body,
    createdAt: comments[0].created_at,
  } : undefined;

  return {
    meta: {
      number: pr.number,
      title: pr.title,
      author: pr.user?.login || 'unknown',
      state: pr.merged_at ? 'merged' as const : pr.state as 'open' | 'closed',
      labels: pr.labels?.map((l) => l.name) || [],
      createdAt: pr.created_at,
      mergedAt: pr.merged_at || undefined,
      mergedBy: pr.merged_by?.login || undefined,
      baseRef: pr.base?.ref || '',
      headRef: pr.head?.ref || '',
      body: pr.body || undefined,
    },
    packages,
    entries,
    // A1: No more `commits` duplication — entries is the single source of truth
    related: {
      reviewNote,
      filesChanged: pr.changed_files != null
        ? {
            count: pr.changed_files,
            additions: pr.additions || 0,
            deletions: pr.deletions || 0,
          }
        : undefined,
    },
  };
}

/** Extract first line of commit message as subject */
function extractSubject(message: string): string {
  return message.split('\n')[0].trim();
}
