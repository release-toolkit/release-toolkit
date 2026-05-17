import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';

export interface WorkspaceInfo {
  packages: string[];
}

export interface WorkspaceConfig {
  packages: string[];
}

/**
 * 扫描 workspace 配置文件
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
  const data = load(content) as WorkspaceConfig | null;
  return { packages: data?.packages || [] };
}
