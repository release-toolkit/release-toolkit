import { diffFiles, showFileContent } from './git/git-reader.js';
import { resolve } from 'node:path';
import type { VersionDiffResult, PackageVersionInfo } from './types.js';
import { compareVersions } from './version-compare.js';
import { IS_WORKER } from './utils.js';
import { detectVersionChangesByAPI, matchesWorkspaceFilePath } from './version-api.js';

/**
 * 检测版本变更
 *
 * - 本地 / CI runner：通过 git diff + git show 对比 base/HEAD 的 package.json
 * - Cloudflare Worker / 无 git：通过 GitHub Compare API + Contents API（需 GITHUB_TOKEN、GITHUB_REPOSITORY）
 */
export async function detectVersionChanges(
  baseRef: string,
  headRef: string,
  workspacePatterns: string[],
  cwd?: string,
): Promise<VersionDiffResult[]> {
  if (IS_WORKER) {
    return detectVersionChangesByAPI(baseRef, headRef, workspacePatterns);
  }
  return detectVersionChangesLocal(baseRef, headRef, workspacePatterns, cwd);
}

async function detectVersionChangesLocal(
  baseRef: string,
  headRef: string,
  workspacePatterns: string[],
  cwd?: string,
): Promise<VersionDiffResult[]> {
  const diffs: VersionDiffResult[] = [];
  const basePath = cwd || process.cwd();

  // 获取 base..head 之间变更的文件（相对仓库根路径），
  // 与 API 模式对齐：筛选出落在 workspace glob 范围内的 package.json。
  const changedFiles = await diffFiles(baseRef, headRef, basePath);
  const changedPkgJsonPaths = changedFiles.filter(
    (f) => f.endsWith('/package.json') && matchesWorkspaceFilePath(f, workspacePatterns),
  );

  for (const pkgJsonPath of changedPkgJsonPaths) {
    const oldContent = await showFileContent(baseRef, pkgJsonPath, basePath).catch(() => '');
    const newContent = await showFileContent(headRef, pkgJsonPath, basePath).catch(() => '');

    if (!oldContent || !newContent) continue;

    let oldPkg: { name?: string; version?: string };
    let newPkg: { name?: string; version?: string };
    try {
      oldPkg = JSON.parse(oldContent);
      newPkg = JSON.parse(newContent);
    } catch {
      continue;
    }

    const oldVersion = oldPkg.version || '0.0.0';
    const newVersion = newPkg.version || '0.0.0';

    if (oldVersion === newVersion) continue;

    const diffType = compareVersions(oldVersion, newVersion);
    const pkgDir = pkgJsonPath.replace(/\/package\.json$/, '');
    const pkgInfo: PackageVersionInfo = {
      packageName: newPkg.name || pkgDir.split('/').pop() || pkgDir,
      packagePath: pkgDir,
      currentVersion: oldVersion,
      newVersion,
    };

    diffs.push({ package: pkgInfo, diffType });
  }

  return diffs;
}

/**
 * 把 workspace 配置项中的 glob 表达式（仅支持 `dir/*`）转换为绝对目录。
 *
 * 例：`['packages/*']` + `/project` → `['/project/packages']`
 */
export function resolvePackageDirs(patterns: string[], basePath: string): string[] {
  const dirs: string[] = [];
  for (const pattern of patterns) {
    if (pattern.endsWith('/*')) {
      const base = pattern.slice(0, -2);
      dirs.push(resolve(basePath, base));
    } else {
      dirs.push(resolve(basePath, pattern));
    }
  }
  return dirs;
}

export { compareVersions } from './version-compare.js';
