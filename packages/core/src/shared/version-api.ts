import { createOctokit } from './github/api-client.js';
import type { OctokitInstance } from './github/types.js';
import type { PackageVersionInfo, VersionDiffResult } from './types.js';
import { compareVersions } from './version-compare.js';

export interface RepoVersionContext {
  owner: string;
  repo: string;
  baseRef: string;
  headRef: string;
  token?: string;
}

interface CompareFile {
  filename: string;
}

/** 判断变更文件是否落在 workspace glob 范围内（如 `packages/*`） */
export function matchesWorkspaceFilePath(filePath: string, patterns: string[]): boolean {
  if (patterns.length === 0) return true;
  if (patterns.some((p) => p.endsWith('.yaml') || p.endsWith('.yml'))) {
    return filePath.endsWith('/package.json');
  }
  for (const pattern of patterns) {
    const prefix = pattern.endsWith('/*') ? pattern.slice(0, -2) : pattern;
    if (filePath === `${prefix}/package.json` || filePath.startsWith(`${prefix}/`)) {
      return true;
    }
  }
  return false;
}

function decodeContentBase64(content: string): string {
  return typeof Buffer !== 'undefined'
    ? Buffer.from(content, 'base64').toString('utf-8')
    : atob(content.replace(/\n/g, ''));
}

async function getPackageJsonAtRef(
  octokit: OctokitInstance,
  owner: string,
  repo: string,
  path: string,
  ref: string,
): Promise<{ name?: string; version?: string } | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path, ref });
    if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) return null;
    return JSON.parse(decodeContentBase64(data.content)) as {
      name?: string;
      version?: string;
    };
  } catch {
    return null;
  }
}

/** 列出 compare 结果中落在 workspace 范围内的 package.json 路径（如 `packages/core`） */
export async function listChangedPackagePathsWithOctokit(
  octokit: OctokitInstance,
  ctx: Pick<RepoVersionContext, 'owner' | 'repo' | 'baseRef' | 'headRef'>,
  workspacePatterns: string[],
): Promise<string[]> {
  const { data } = await octokit.rest.repos.compareCommits({
    owner: ctx.owner,
    repo: ctx.repo,
    base: ctx.baseRef,
    head: ctx.headRef,
  });

  const paths = new Set<string>();
  for (const file of (data.files ?? []) as CompareFile[]) {
    if (!file.filename.endsWith('/package.json')) continue;
    if (!matchesWorkspaceFilePath(file.filename, workspacePatterns)) continue;
    paths.add(file.filename.replace(/\/package\.json$/, ''));
  }
  return Array.from(paths);
}

/**
 * 使用已有 Octokit 检测 workspace 内 package.json 版本变更（App Server / Actions 通用）。
 */
export async function detectVersionChangesWithOctokit(
  octokit: OctokitInstance,
  ctx: Pick<RepoVersionContext, 'owner' | 'repo' | 'baseRef' | 'headRef'>,
  workspacePatterns: string[],
): Promise<VersionDiffResult[]> {
  const changedPaths = await listChangedPackagePathsWithOctokit(
    octokit,
    ctx,
    workspacePatterns,
  );

  const diffs: VersionDiffResult[] = [];
  for (const pkgDir of changedPaths) {
    const pkgJsonPath = `${pkgDir}/package.json`;
    const [basePkg, headPkg] = await Promise.all([
      getPackageJsonAtRef(octokit, ctx.owner, ctx.repo, pkgJsonPath, ctx.baseRef),
      getPackageJsonAtRef(octokit, ctx.owner, ctx.repo, pkgJsonPath, ctx.headRef),
    ]);
    if (!headPkg?.version) continue;

    const oldVersion = basePkg?.version ?? '0.0.0';
    const newVersion = headPkg.version;
    if (oldVersion === newVersion) continue;

    const diffType = compareVersions(oldVersion, newVersion);
    const pkgInfo: PackageVersionInfo = {
      packageName: headPkg.name ?? pkgDir.split('/').pop() ?? pkgDir,
      packagePath: pkgDir,
      currentVersion: oldVersion,
      newVersion,
    };
    diffs.push({ package: pkgInfo, diffType });
  }

  return diffs;
}

/**
 * 在 Worker / 无 git 环境通过 GitHub API 检测 package.json 版本变更。
 * 需要 `GITHUB_TOKEN` 与 `GITHUB_REPOSITORY`（owner/repo）。
 */
export async function detectVersionChangesByAPI(
  baseRef: string,
  headRef: string,
  workspacePatterns: string[],
): Promise<VersionDiffResult[]> {
  const token = process.env.GITHUB_TOKEN;
  const repoFull = process.env.GITHUB_REPOSITORY;
  if (!token || !repoFull) {
    console.warn(
      '[version] API 模式缺少 GITHUB_TOKEN / GITHUB_REPOSITORY，跳过版本检测',
    );
    return [];
  }

  const [owner, repo] = repoFull.split('/');
  if (!owner || !repo) {
    console.warn('[version] GITHUB_REPOSITORY 格式无效，应为 owner/repo');
    return [];
  }

  const octokit = await createOctokit(token);
  return detectVersionChangesWithOctokit(
    octokit,
    { owner, repo, baseRef, headRef },
    workspacePatterns,
  );
}
