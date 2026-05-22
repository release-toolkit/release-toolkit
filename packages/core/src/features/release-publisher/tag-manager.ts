import { createTag, pushTags } from '../../shared/git/git-reader.js';
import { createTag as createTagByAPI, pushTag as pushTagByAPI, getLatestCommitSha } from '../../shared/github/octokit.js';
import type { GitTagsConfig } from '../../shared/config/index.js';
import { resolveGitTagMessage, resolveGitTagName } from '../../shared/config/git-tag-format.js';
import type { VersionDiffResult } from '../../shared/types.js';
import { IS_WORKER } from '../../shared/utils.js';

export async function createTagsForDiffs(
  diffs: VersionDiffResult[],
  cwd?: string,
  gitTags?: GitTagsConfig,
): Promise<Array<{ tagName: string; success: boolean; error?: string }>> {
  // 类型断言：确保 diffs 是 VersionDiffResult[]
  const diffList = diffs as VersionDiffResult[];
  // Worker 环境使用 API
  if (IS_WORKER) {
    return createTagsByAPI(diffList, gitTags);
  }

  // 本地环境使用 git 命令
  return createTagsByGit(diffList, cwd, gitTags);
}

async function createTagsByGit(
  diffs: VersionDiffResult[],
  cwd?: string,
  gitTags?: GitTagsConfig,
): Promise<Array<{ tagName: string; success: boolean; error?: string }>> {
  const results: Array<{
    tagName: string;
    success: boolean;
    error?: string;
  }> = [];

  for (const diff of diffs) {
    const tagName = resolveGitTagName(
      gitTags,
      diff.package.packageName,
      diff.package.newVersion,
    );
    const tagMessage = resolveGitTagMessage(
      gitTags,
      diff.package.packageName,
      diff.package.newVersion,
    );
    try {
      await createTag(tagName, tagMessage, cwd);
      results.push({ tagName, success: true });
    } catch (err) {
      results.push({
        tagName,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 推送所有 tag
  if (results.some((r) => r.success)) {
    try {
      await pushTags(cwd);
    } catch {
      // 推送失败不影响已创建的 tag
    }
  }

  return results;
}

async function createTagsByAPI(
  diffs: VersionDiffResult[],
  gitTags?: GitTagsConfig,
): Promise<Array<{ tagName: string; success: boolean; error?: string }>> {
  const results: Array<{
    tagName: string;
    success: boolean;
    error?: string;
  }> = [];

  const token = process.env.GITHUB_TOKEN || '';
  const owner = process.env.GITHUB_REPOSITORY?.split('/')[0] || '';
  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';

  if (!token || !owner || !repo) {
    return diffs.map((diff) => ({
      tagName: resolveGitTagName(
        gitTags,
        diff.package.packageName,
        diff.package.newVersion,
      ),
      success: false,
      error: '缺少 GitHub 配置',
    }));
  }

  // 获取 main 分支最新 commit SHA
  const mainSha = await getLatestCommitSha(
    { token, owner, repo },
    process.env.GITHUB_REF_NAME || 'main',
  );

  for (const diff of diffs) {
    const tagName = resolveGitTagName(
      gitTags,
      diff.package.packageName,
      diff.package.newVersion,
    );
    const tagMessage = resolveGitTagMessage(
      gitTags,
      diff.package.packageName,
      diff.package.newVersion,
    );
    try {
      // 1. 创建 annotated tag 对象，得到 tag sha
      const tagObject = await createTagByAPI(
        { token, owner, repo },
        tagName,
        tagMessage,
        mainSha,
      );

      // 2. 创建 refs/tags/{name} 指向该 tag sha 才能在仓库中可见
      await pushTagByAPI(
        { token, owner, repo },
        tagName,
        tagObject.sha,
      );

      results.push({ tagName, success: true });
    } catch (err) {
      results.push({
        tagName,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return results;
}
