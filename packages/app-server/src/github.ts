import { Octokit } from 'octokit';

interface GitHubClientOptions {
  token?: string;
  appId?: number;
  privateKeyPem?: string;
  installationId?: number;
}

/**
 * 创建 GitHub 客户端
 */
export function createGitHubClient(options: GitHubClientOptions): Octokit {
  const { token, appId, privateKeyPem, installationId } = options;

  if (token) {
    return new Octokit({
      auth: `Bearer ${token}`,
      userAgent: 'release-toolkit',
    });
  }

  if (appId && privateKeyPem && installationId) {
    // 使用 app 模式需要动态获取 token
    // 这里返回一个基础客户端，实际调用时需要先获取 token
    return new Octokit({
      userAgent: 'release-toolkit',
    });
  }

  throw new Error('Must provide either token or appId with privateKeyPem and installationId');
}

/**
 * 在 PR 上添加评论
 */
export async function commentOnPR(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string
): Promise<void> {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

/**
 * 触发 GitHub Workflow
 */
export async function triggerWorkflow(
  octokit: Octokit,
  owner: string,
  repo: string,
  workflowId: string,
  ref: string,
  inputs?: Record<string, unknown>
): Promise<void> {
  await octokit.rest.actions.createWorkflowDispatch({
    owner,
    repo,
    workflow_id: workflowId,
    ref,
    inputs,
  });
}

/**
 * 获取 PR 标题
 */
export async function getPRTitle(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  return data.title;
}

/**
 * 获取 PR 描述
 */
export async function getPRBody(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string | null> {
  const { data } = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  return data.body;
}
