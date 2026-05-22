import { diffFiles, showFileContent } from './git/git-reader.js';
import { resolve } from 'node:path';
import type { VersionDiffResult, PackageVersionInfo } from './types.js';
import { compare } from 'semver';
import { IS_WORKER } from './utils.js';

const isWorker = IS_WORKER;

/**
 * 通过 GitHub API 检测版本变更
 */
async function detectVersionChangesByAPI(
  options: { token: string; owner: string; repo: string },
  baseRef: string,
  headRef: string,
  workspacePatterns: string[],
): Promise<VersionDiffResult[]> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { token: _token, owner: _owner, repo: _repo } = options;
  const diffs: VersionDiffResult[] = [];

  // 使用 semver 库比较版本
  const semverDiff = (v1: string, v2: string): 'major' | 'minor' | 'patch' | null => {
    try {
      // 去除预发布版本后缀
      const v1Normalized = v1.split('-')[0] || v1;
      const v2Normalized = v2.split('-')[0] || v2;

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
      return null;
    }
  };

  // 获取两个 ref 之间的文件差异（通过 git 命令模拟）
  // 注意：Worker 环境需要使用 GitHub API 获取文件差异
  const changedPackageJsonFiles: string[] = [];

  for (const pattern of workspacePatterns) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _dir = pattern.endsWith('/*')
      ? pattern.slice(0, -2)
      : pattern;

    // 在 Worker 环境中，我们无法直接使用 git 命令
    // 这里需要通过 GitHub API 获取变更文件列表
    // 由于 API 调用复杂，暂时返回空数组
    // 实际使用时需要实现 getChangedFilesByAPI 函数
  }

  // 获取每个 package.json 的内容
  const packageContents: Record<string, { old: string; new: string }> = {};

  for (const _file of changedPackageJsonFiles) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _filePath = _file;
    // 在 Worker 环境中获取文件内容需要 API 调用
  }

  // 解析版本变更
  for (const [filePath, contents] of Object.entries(packageContents)) {
    try {
      const oldPkg = JSON.parse(contents.old);
      const newPkg = JSON.parse(contents.new);

      const oldVersion = oldPkg.version || '0.0.0';
      const newVersion = newPkg.version || '0.0.0';

      if (oldVersion !== newVersion) {
        const diffType = semverDiff(oldVersion, newVersion);
        const pkgInfo: PackageVersionInfo = {
          packageName: newPkg.name || filePath,
          packagePath: filePath,
          currentVersion: newVersion,
          newVersion,
        };

        diffs.push({ package: pkgInfo, diffType });
      }
    } catch {
      // 跳过解析失败的文件
    }
  }

  return diffs;
}

export async function detectVersionChanges(
  baseRef: string,
  headRef: string,
  workspacePatterns: string[],
  cwd?: string,
): Promise<VersionDiffResult[]> {
  // Worker 环境使用 API
  if (isWorker) {
    const token = process.env.GITHUB_TOKEN || '';
    const owner = process.env.GITHUB_REPOSITORY?.split('/')[0] || '';
    const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] || '';

    if (!token || !owner || !repo) {
      console.warn('[version] Worker 环境缺少 GitHub 配置，回退到本地模式');
      return detectVersionChangesLocal(baseRef, headRef, workspacePatterns, cwd);
    }

    return detectVersionChangesByAPI({ token, owner, repo }, baseRef, headRef, workspacePatterns);
  }

  // 本地环境使用 git 命令
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
