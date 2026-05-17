import { Octokit } from 'octokit';

interface GitHubClientOptions {
  token?: string;
  jwt?: string;
  installationId?: number;
}

/**
 * 创建 GitHub 客户端
 */
export function createGitHubClient(options: GitHubClientOptions): Octokit {
  const { token, jwt, installationId } = options;

  if (token) {
    return new Octokit({
      auth: `Bearer ${token}`,
      userAgent: 'release-toolkit',
    });
  }

  if (jwt && installationId) {
    // 使用 JWT + installationId 获取 access token（后续调用时会处理）
    return new Octokit({
      auth: jwt,
      userAgent: 'release-toolkit',
    });
  }

  throw new Error('Must provide either token or jwt with installationId');
}

/**
 * 使用 JWT 和 installationId 获取 access token 并创建认证客户端
 */
export async function createAuthenticatedClientWithInstallation(
  jwt: string,
  installationId: number
): Promise<Octokit> {
  const octokit = createGitHubClient({ jwt });
  
  const response = await octokit.rest.apps.createInstallationAccessToken({
    installation_id: installationId,
  });
  
  const accessToken = response.data.token;
  return createGitHubClient({ token: accessToken });
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
