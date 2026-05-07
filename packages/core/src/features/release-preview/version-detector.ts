import { diffFiles, showFileContent } from '../../shared/git/git-reader.js';
import { resolve } from 'node:path';
import type { PackageVersionDiff } from './types.js';

export async function detectVersionChanges(
  baseRef: string,
  headRef: string,
  workspacePatterns: string[],
  _cwd?: string,
): Promise<PackageVersionDiff[]> {
  const diffs: PackageVersionDiff[] = [];
  const basePath = _cwd || process.cwd();

  // 将 glob pattern 转换为实际目录列表
  const packageDirs = resolvePackageDirs(workspacePatterns, basePath);

  for (const pkgDir of packageDirs) {
    const pkgJsonPath = `${pkgDir}/package.json`;
    const changedFiles = await diffFiles(baseRef, headRef, basePath);
    const hasPackageJsonChanged = changedFiles.some(
      (f) => f === pkgJsonPath || f.endsWith('/package.json'),
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
      diffs.push({
        packageName: newPkg.name || pkgDir,
        packageDir: pkgDir,
        oldVersion,
        newVersion,
        diffType: compareVersions(oldVersion, newVersion),
      });
    }
  }

  return diffs;
}

export function resolvePackageDirs(patterns: string[], basePath: string): string[] {
  const dirs: string[] = [];
  for (const pattern of patterns) {
    if (pattern.endsWith('/*')) {
      const base = pattern.replace(/\*$/, '');
      dirs.push(resolve(basePath, base)); // 使用 resolve 解析路径
    } else {
      dirs.push(resolve(basePath, pattern));
    }
  }
  return dirs;
}

export function compareVersions(v1: string, v2: string): 'major' | 'minor' | 'patch' | null {
  // 去除预发布版本后缀（如 1.0.1-alpha.1 → 1.0.1）
  const v1Normalized = v1.split('-')[0] || v1;
  const v2Normalized = v2.split('-')[0] || v2;

  const p1 = v1Normalized.split('.').map(Number);
  const p2 = v2Normalized.split('.').map(Number);

  if (p2[0] > p1[0]) return 'major';
  if (p2[1] > p1[1]) return 'minor';
  if (p2[2] > p1[2]) return 'patch';
  return null;
}
