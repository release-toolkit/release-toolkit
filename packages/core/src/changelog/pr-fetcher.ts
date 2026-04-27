import type { PRChangelogData, CommitTitle } from './pr-changelog-types.js';
import { extractReleaseLog, extractDeclaredPackages } from './pr-changelog-template.js';
import { loadPRChangelogConfig } from '../config/index.js';
import type { PRChangelogConfig } from '../config/index.js';

// ============================================================
// Types — Raw GitHub API response shapes (minimal)
// ============================================================

interface GitHubCommit {
  sha: string;
  commit?: {
    message: string;
    author?: {
      date: string;
    };
  };
}

interface GitHubComment {
  id: number;
  user?: {
    login: string;
  };
  body: string;
  created_at: string;
}

/** File entry from PR listFiles API */
interface GitHubPRFile {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
}

interface GitHubPRDetail {
  number: number;
  title: string;
  user?: {
    login: string;
  };
  state: string;
  merged_at: string | null;
  merged_by?: {
    login: string;
  } | null;
  base?: {
    ref: string;
  };
  head?: {
    ref: string;
  };
  labels?: Array<{
    name: string;
  }>;
  created_at: string;
  body?: string | null;
  changed_files?: number;
  additions?: number;
  deletions?: number;
}

// ============================================================
// PR Fetcher — GitHub API → PRChangelogData
// ============================================================

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
    // B3/C2: paginated file listing
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

// ============================================================
// Private — GitHub API calls
// ============================================================

async function getPR(
  octokit: InstanceType<typeof import('octokit').Octokit>,
  opts: PRFetcherOptions,
): Promise<GitHubPRDetail> {
  const res = await octokit.rest.pulls.get({
    owner: opts.owner,
    repo: opts.repo,
    pull_number: opts.prNumber,
  });
  return res.data as unknown as GitHubPRDetail;
}

async function getCommits(
  octokit: InstanceType<typeof import('octokit').Octokit>,
  opts: PRFetcherOptions,
): Promise<GitHubCommit[]> {
  const res = await octokit.rest.pulls.listCommits({
    owner: opts.owner,
    repo: opts.repo,
    pull_number: opts.prNumber,
    per_page: 100,
  });
  return res.data as unknown as GitHubCommit[];
}

/** Get first comment on a PR (non-bot, non-system) */
async function getFirstReviewComment(
  octokit: InstanceType<typeof import('octokit').Octokit>,
  opts: PRFetcherOptions,
): Promise<GitHubComment[]> {
  const res = await octokit.rest.issues.listComments({
    owner: opts.owner,
    repo: opts.repo,
    issue_number: opts.prNumber,
    per_page: 50,
  });

  // Filter out bot/system comments, take first real human comment
  const comments = (res.data as unknown as GitHubComment[])
    .filter((c) => c.user && !c.user.login.endsWith('[bot]'));

  return comments.slice(0, 1);
}

/**
 * Get ALL changed files for a PR with pagination support.
 * B3/C2: Handles PRs with >100 files by following the Link header.
 */
async function getAllFiles(
  octokit: InstanceType<typeof import('octokit').Octokit>,
  opts: PRFetcherOptions,
): Promise<GitHubPRFile[]> {
  const allFiles: GitHubPRFile[] = [];
  let page = 1;
  const perPage = 100;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await octokit.rest.pulls.listFiles({
      owner: opts.owner,
      repo: opts.repo,
      pull_number: opts.prNumber,
      per_page: perPage,
      page,
    });

    const pageFiles = (res.data as unknown as GitHubPRFile[]);
    allFiles.push(...pageFiles);

    // Check if there are more pages (GitHub returns Link header for pagination)
    // Octokit exposes this via res.headers.link or we can check if we got less than perPage
    if (pageFiles.length < perPage) {
      break;
    }

    page++;
  }

  return allFiles;
}

// ============================================================
// Private — Data helpers
// ============================================================

/** Extract first line of commit message as subject */
function extractSubject(message: string): string {
  return message.split('\n')[0].trim();
}

/**
 * Resolve affected package list — priority order:
 *
 * 1. **Explicit declaration** from first PR comment: `<!-- PACKAGES: @pkg/a, @pkg/b -->`
 * 2. **Diff inference** — map changed file paths to package directories using config
 * 3. **Fallback** — extract from commit messages & labels (legacy regex match)
 *
 * A2/B2/B4: Uses configurable packagesDir, packageMap, and rootTag.
 */
function resolvePackages(
  pr: GitHubPRDetail,
  commits: GitHubCommit[],
  files: GitHubPRFile[],
  comments: GitHubComment[],
  cfg: Required<PRChangelogConfig>,
): string[] {

  // ── Priority 1: Explicit declaration from first comment ──
  if (comments.length > 0) {
    const declared = extractDeclaredPackages(comments[0].body);
    if (declared && declared.length > 0) {
      return declared;
    }
  }

  // ── Priority 2: Diff-based inference from file paths (with config) ──
  const diffPkgs = inferPackagesFromFiles(files, cfg);
  if (diffPkgs.length > 0) {
    return diffPkgs;
  }

  // ── Priority 3: Fallback — commit messages + labels ──
  return fallbackExtractPackages(pr, commits, cfg);
}

/**
 * Infer package names from changed file paths.
 *
 * A2/B4: Uses configurable:
 *   - `packagesDir`: the monorepo packages directory name (default "packages")
 *   - `packageMap`: directory name → explicit package name mapping
 *   - `rootTag`: tag for non-package files (default "root")
 *
 * Strategy:
 * - Files under `{packagesDir}/{dirname}/...` → resolve via packageMap or heuristic
 * - Files NOT under `{packagesDir}/` → tagged as configured `rootTag`
 */
function inferPackagesFromFiles(files: GitHubPRFile[], cfg: Required<PRChangelogConfig>): string[] {
  const pkgs = new Set<string>();
  let hasNonPackageFile = false;

  for (const f of files) {
    const segments = f.filename.split('/');

    // Check if file is under {packagesDir}/{name}/
    if (segments[0] === cfg.packagesDir && segments[1]) {
      const pkgDirName = segments[1];
      // A2: Use explicit map if available, otherwise fallback to @dirName heuristic
      const pkgName = cfg.packageMap[pkgDirName] ?? `@${pkgDirName}`;
      pkgs.add(pkgName);
    } else {
      hasNonPackageFile = true;
    }
  }

  // B4: Use configurable root tag for non-packages files
  if (hasNonPackageFile) {
    pkgs.add(cfg.rootTag);
  }

  return [...pkgs].sort();
}

/**
 * Fallback: extract packages from commit message @scope/pkg patterns and PR labels.
 * B4: Uses configurable rootTag when nothing matches.
 */
function fallbackExtractPackages(
  pr: GitHubPRDetail,
  commits: GitHubCommit[],
  cfg: Required<PRChangelogConfig>,
): string[] {
  const pkgs = new Set<string>();

  // From commit subjects: look for @scope/name patterns
  for (const c of commits) {
    const msg = c.commit?.message || '';
    const matches = msg.match(/@[\w-]+\/[\w-]+/g);
    if (matches) {
      for (const m of matches) pkgs.add(m);
    }
  }

  // From PR labels (if they look like package names)
  if (pr.labels) {
    for (const label of pr.labels) {
      if (label.name.startsWith('@')) pkgs.add(label.name);
    }
  }

  // B4: If nothing found at all, use configurable root tag
  if (pkgs.size === 0) {
    pkgs.add(cfg.rootTag);
  }

  return [...pkgs].sort();
}
