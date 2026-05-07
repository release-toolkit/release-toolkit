import type { GithubContext } from '../types.js';
import type { OctokitInstance, PullRequestData, IssueCommentData } from './types.js';

let _octokit: OctokitInstance | null = null;

export async function getOctokit(token?: string): Promise<OctokitInstance> {
  if (_octokit) return _octokit;

  try {
    const { Octokit } = await import('octokit');
    _octokit = new Octokit({
      auth: token || process.env.GITHUB_TOKEN || undefined,
    }) as OctokitInstance;
    return _octokit;
  } catch {
    throw new Error(
      'octokit is not installed. Please install it with: pnpm add octokit',
    );
  }
}

export async function getPR(
  context: GithubContext,
): Promise<{ data: PullRequestData }> {
  const octokit = await getOctokit();
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
  const octokit = await getOctokit();
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
  const octokit = await getOctokit();
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
  const octokit = await getOctokit();
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
  const octokit = await getOctokit();
  await octokit.rest.pulls.update({
    owner: context.repoOwner!,
    repo: context.repoName!,
    pull_number: context.prNumber!,
    body,
  });
}
