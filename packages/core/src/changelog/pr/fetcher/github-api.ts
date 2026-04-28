// ============================================================
// GitHub API types (minimal, internal to fetcher)
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
// GitHub API call helpers
// ============================================================

export async function getPR(
  octokit: InstanceType<typeof import('octokit').Octokit>,
  opts: { owner: string; repo: string; prNumber: number },
): Promise<GitHubPRDetail> {
  const res = await octokit.rest.pulls.get({
    owner: opts.owner,
    repo: opts.repo,
    pull_number: opts.prNumber,
  });
  return res.data as unknown as GitHubPRDetail;
}

export async function getCommits(
  octokit: InstanceType<typeof import('octokit').Octokit>,
  opts: { owner: string; repo: string; prNumber: number },
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
export async function getFirstReviewComment(
  octokit: InstanceType<typeof import('octokit').Octokit>,
  opts: { owner: string; repo: string; prNumber: number },
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
 * Handles PRs with >100 files by paginating through all pages.
 */
export async function getAllFiles(
  octokit: InstanceType<typeof import('octokit').Octokit>,
  opts: { owner: string; repo: string; prNumber: number },
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
