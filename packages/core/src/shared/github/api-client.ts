import type { GithubContext } from '../types.js';
import type { OctokitInstance, PullRequestData, IssueCommentData } from './types.js';

/**
 * 创建 Octokit 实例
 */
export async function createOctokit(token?: string): Promise<OctokitInstance> {
  try {
    const { Octokit } = await import('octokit');
    return new Octokit({
      auth: token || process.env.GITHUB_TOKEN || undefined,
    }) as OctokitInstance;
  } catch {
    throw new Error(
      'octokit is not installed. Please install it with: pnpm add octokit',
    );
  }
}

export async function getPR(
  context: GithubContext,
): Promise<{ data: PullRequestData }> {
  const octokit = await createOctokit();
  const { data } = await octokit.rest.pulls.get({
    owner: context.repoOwner!,
    repo: context.repoName!,
    pull_number: context.prNumber!,
  });
  return { data };
}

export async function getPRComments(
  context: GithubContext,
): Promise<{ data: IssueCommentData[] }> {
  const octokit = await createOctokit();
  const { data } = await octokit.rest.issues.listComments({
    owner: context.repoOwner!,
    repo: context.repoName!,
    issue_number: context.prNumber!,
  });
  return { data };
}

export async function createPRComment(
  context: GithubContext,
  body: string,
): Promise<void> {
  const octokit = await createOctokit();
  await octokit.rest.issues.createComment({
    owner: context.repoOwner!,
    repo: context.repoName!,
    issue_number: context.prNumber!,
    body,
  });
}

export async function updatePRComment(
  context: GithubContext,
  commentId: number,
  body: string,
): Promise<void> {
  const octokit = await createOctokit();
  await octokit.rest.issues.updateComment({
    owner: context.repoOwner!,
    repo: context.repoName!,
    comment_id: commentId,
    body,
  });
}

export async function updatePR(
  context: GithubContext,
  body: string,
): Promise<void> {
  const octokit = await createOctokit();
  await octokit.rest.pulls.update({
    owner: context.repoOwner!,
    repo: context.repoName!,
    pull_number: context.prNumber!,
    body,
  });
}

/**
 * 获取仓库的 PR 列表
 *
 * @param context GitHub 上下文（需要 token, owner, repo）
 * @param options 筛选条件：
 *   - state：PR 状态（默认 `'open'`）
 *   - base：目标分支（如 `'dev'`），用于聚合已合并到该分支的 PR
 *   - head：源分支（GitHub API 要求 `org:branch` 格式）
 */
export async function getPullRequests(
  context: { token?: string; owner: string; repo: string },
  options: {
    state?: 'open' | 'closed' | 'all';
    base?: string;
    head?: string;
  } = {},
): Promise<Array<{ number: number; title: string; body?: string | null; merged?: boolean }>> {
  const octokit = await createOctokit(context.token);

  const params: Parameters<typeof octokit.rest.pulls.list>[0] = {
    owner: context.owner,
    repo: context.repo,
    state: options.state || 'open',
  };

  if (options.base) params.base = options.base;
  if (options.head) params.head = options.head;

  const { data } = await octokit.rest.pulls.list(params);

  return data.map((item) => ({
    number: item.number,
    title: item.title,
    body: item.body,
    merged: (item as { merged?: boolean }).merged ?? false,
  }));
}
