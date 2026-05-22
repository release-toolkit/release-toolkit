import type { Octokit } from 'octokit';
import {
  detectVersionChangesWithOctokit,
  fetchWorkspacePackagesWithOctokit,
  listChangedPackagePathsWithOctokit,
  type VersionDiffResult,
} from '@release-toolkit/core';
import type { PRContext, VersionDiff } from './format.js';

export function workspaceFileFromConfig(
  config: Record<string, unknown> | null,
): string {
  const preview = config?.releasePreview;
  if (preview && typeof preview === 'object' && 'workspaceFile' in preview) {
    const file = (preview as { workspaceFile?: string }).workspaceFile;
    if (typeof file === 'string' && file.length > 0) return file;
  }
  return 'pnpm-workspace.yaml';
}

function toVersionDiff(d: VersionDiffResult): VersionDiff {
  return {
    packageName: d.package.packageName,
    currentVersion: d.package.currentVersion,
    newVersion: d.package.newVersion,
  };
}

/** 目录路径 `packages/foo` → 评论用短名 `foo` */
export function packagePathToDirName(packagePath: string): string {
  return packagePath.split('/').pop() ?? packagePath;
}

/**
 * 与 core 对齐：读 workspace 配置 + Compare API 检测版本变更。
 */
export async function resolvePRVersionState(
  octokit: Octokit,
  prCtx: PRContext,
  repoConfig: Record<string, unknown> | null,
): Promise<{ versionDiffs: VersionDiff[]; changedPackages: string[] }> {
  const workspaceFile = workspaceFileFromConfig(repoConfig);
  const ref = prCtx.headSha || prCtx.headRef;
  const patterns = await fetchWorkspacePackagesWithOctokit(
    octokit,
    { owner: prCtx.owner, repo: prCtx.repo, ref },
    workspaceFile,
  );
  const workspacePatterns = patterns.length > 0 ? patterns : ['packages/*'];

  const versionResults = await detectVersionChangesWithOctokit(
    octokit,
    {
      owner: prCtx.owner,
      repo: prCtx.repo,
      baseRef: prCtx.baseRef,
      headRef: ref,
    },
    workspacePatterns,
  );

  const allChangedPaths = await listChangedPackagePathsWithOctokit(
    octokit,
    {
      owner: prCtx.owner,
      repo: prCtx.repo,
      baseRef: prCtx.baseRef,
      headRef: ref,
    },
    workspacePatterns,
  );

  const changedPackages = allChangedPaths.map(packagePathToDirName);

  return {
    versionDiffs: versionResults.map(toVersionDiff),
    changedPackages,
  };
}
