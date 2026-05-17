import { createOctokit } from '../../shared/github/api-client.js';
import type { ReleaseHookContext } from './types.js';

export async function createGithubRelease(
  context: ReleaseHookContext,
  repoOwner: string,
  repoName: string,
  token?: string,
): Promise<string | null> {
  try {
    const octokit = await createOctokit(token);
    const { data } = await octokit.rest.repos.createRelease({
      owner: repoOwner,
      repo: repoName,
      tag_name: context.tagName,
      name: `${context.packageName}@${context.newVersion}`,
      body: `Release ${context.newVersion}`,
      draft: false,
      prerelease: false,
    });
    return data.html_url as string;
  } catch (err) {
    throw new Error(
      `创建 GitHub Release 失败：${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
