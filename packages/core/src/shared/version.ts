import { diffFiles, showFileContent } from './git/git-reader.js';
import { resolve } from 'node:path';
import type { VersionDiffResult, PackageVersionInfo } from './types.js';
import { compare } from 'semver';
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

/**
 * 比较两个版本号，返回变更类型
 * 使用 semver 库进行准确比较
 */
export function compareVersions(v1: string, v2: string): 'major' | 'minor' | 'patch' | null {
  // 去除预发布版本后缀（如 1.0.1-alpha.1 → 1.0.1）
  const v1Normalized = v1.split('-')[0] || v1;
  const v2Normalized = v2.split('-')[0] || v2;

  try {
    const c = compare(v1Normalized, v2Normalized);
    if (c < 0) {
      const p1 = v1Normalized.split('.').map(Number);
      const p2 = v2Normalized.split('.').map(Number);

      if (p2[0] > p1[0]) return 'major';
      if (p2[1] > p1[1]) return 'minor';
      if (p2[2] > p1[2]) return 'patch';
    }
    return null;
  } catch {
    // 降级到手写实现
    const parts1 = v1Normalized.split('.').map(Number);
    const parts2 = v2Normalized.split('.').map(Number);

    if (parts2[0] > parts1[0]) return 'major';
    if (parts2[1] > parts1[1]) return 'minor';
    if (parts2[2] > parts1[2]) return 'patch';
    return null;
  }
}
