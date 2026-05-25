import { diffFiles, showFileContent } from './git/git-reader.js';
import { resolve } from 'node:path';
import type { VersionDiffResult, PackageVersionInfo } from './types.js';
import { compareVersions } from './version-compare.js';
import { IS_WORKER } from './utils.js';
import { detectVersionChangesByAPI } from './version-api.js';

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

  const packageDirs = resolvePackageDirs(workspacePatterns, basePath);

  for (const pkgDir of packageDirs) {
    const pkgJsonPath = `${pkgDir}/package.json`;
    const changedFiles = await diffFiles(baseRef, headRef, basePath);
    const hasPackageJsonChanged = changedFiles.some(
      (f: string) => f === pkgJsonPath || f.endsWith('/package.json'),
    );

    if (!hasPackageJsonChanged) continue;

    const oldContent = await showFileContent(baseRef, pkgJsonPath, basePath).catch(() => '');
    const newContent = await showFileContent(headRef, pkgJsonPath, basePath).catch(() => '');

    if (!oldContent || !newContent) continue;

    const oldPkg = JSON.parse(oldContent);
    const newPkg = JSON.parse(newContent);

    const oldVersion = oldPkg.version || '0.0.0';
    const newVersion = newPkg.version || '0.0.0';

    if (oldVersion !== newVersion) {
      const diffType = compareVersions(oldVersion, newVersion);
      const pkgInfo: PackageVersionInfo = {
        packageName: newPkg.name || pkgDir,
        packagePath: pkgDir,
        currentVersion: oldVersion,
        newVersion,
      };

      diffs.push({ package: pkgInfo, diffType });
    }
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
