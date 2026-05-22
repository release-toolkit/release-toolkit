import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { IS_WORKER } from './utils.js';
import {
  fetchWorkspacePackagesByAPI,
  parseWorkspacePackages,
  workspaceContextFromEnv,
  type WorkspaceApiContext,
} from './workspace-api.js';

export type { WorkspaceApiContext } from './workspace-api.js';
export { parseWorkspacePackages } from './workspace-api.js';

export interface WorkspaceInfo {
  packages: string[];
}

/**
 * 扫描 workspace 配置文件（本地文件系统）
 * @param workspaceFile workspace 配置文件路径（默认 pnpm-workspace.yaml）
 * @param cwd 工作目录
 */
export function scanWorkspace(workspaceFile: string, cwd?: string): WorkspaceInfo {
  const basePath = cwd || process.cwd();
  const configPath = resolve(basePath, workspaceFile);

  if (!existsSync(configPath)) {
    return { packages: [] };
  }

  const content = readFileSync(configPath, 'utf-8');
  return { packages: parseWorkspacePackages(content) };
}

export interface ResolveWorkspaceOptions {
  cwd?: string;
  /** API 模式：从 GitHub 仓库读取 workspace 文件 */
  api?: WorkspaceApiContext;
  /** API 模式回退：无 api 时在 Worker 中尝试 GITHUB_* 环境变量 */
  headRef?: string;
}

/**
 * 解析 workspace 包 glob 列表。
 * - 本地：读磁盘上的 workspace 文件
 * - Worker / 传入 api：通过 GitHub Contents API 读取
 */
export async function resolveWorkspacePackages(
  workspaceFile: string,
  options: ResolveWorkspaceOptions = {},
): Promise<string[]> {
  if (options.api) {
    return fetchWorkspacePackagesByAPI(workspaceFile, options.api);
  }

  if (IS_WORKER) {
    const ctx = workspaceContextFromEnv(options.headRef);
    if (ctx) {
      return fetchWorkspacePackagesByAPI(workspaceFile, ctx);
    }
    console.warn('[workspace] Worker 环境缺少 GITHUB_REPOSITORY，无法解析 workspace');
    return [];
  }

  return scanWorkspace(workspaceFile, options.cwd).packages;
}
