import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { load } from 'js-yaml';

export interface WorkspaceInfo {
  packages: string[];
}

export function scanWorkspace(cwd?: string): WorkspaceInfo {
  const basePath = cwd || process.cwd();
  const config = loadConfig(basePath);

  const packages: string[] = [];
  for (const pattern of config.packages) {
    // 简单处理 glob pattern，如 'packages/*' → 列举 packages/ 下的目录
    if (pattern.endsWith('/*')) {
      // 实际应使用 fs.readdirSync，这里简化为返回 pattern 本身
      packages.push(pattern);
    } else {
      packages.push(pattern);
    }
  }

  return { packages };
}

function loadConfig(cwd: string): { packages: string[] } {
  const configPath = resolve(cwd, 'pnpm-workspace.yaml');
  if (!existsSync(configPath)) {
    return { packages: [] };
  }

  const content = readFileSync(configPath, 'utf-8');
  const data = load(content) as { packages?: string[] } | null;
  return { packages: data?.packages || [] };
}
