import type { GithubContext } from '../types.js';

let _octokit: unknown = null;

export async function getOctokit(): Promise<unknown> {
  if (_octokit) return _octokit;

  try {
    const { Octokit } = await import('octokit');
    _octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN || undefined,
    });
    return _octokit;
  } catch {
    throw new Error(
      'octokit is not installed. Please install it with: pnpm add octokit',
    );
  }
}

export async function getPR(
  context: GithubContext,
): Promise<{ data: Record<string, unknown> }> {
  const octokit = await getOctokit();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const octokitAny = octokit as any;
  const { data } = await octokitAny.rest.pulls.get({
    owner: context.repoOwner!,
    repo: context.repoName!,
    pull_number: context.prNumber!,
  });
  return { data };
}

export async function getPRComments(
  context: GithubContext,
): Promise<{ data: Array<Record<string, unknown>> }> {
  const octokit = await getOctokit();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const octokitAny = octokit as any;
  const { data } = await octokitAny.rest.issues.listComments({
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const octokitAny = octokit as any;
  await octokitAny.rest.issues.createComment({
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const octokitAny = octokit as any;
  await octokitAny.rest.issues.updateComment({
    owner: context.repoOwner!,
    repo: context.repoName!,
    comment_id: commentId,
    body,
  });
}
