import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ReleaseToolkitConfig {
  [key: string]: unknown;
  devBranch?: string;
  productionBranch?: string;
  plugins?: string[];
  prLogCollector?: {
    releaseLogMarker?: {
      start?: string;
      end?: string;
    };
  };
  releasePreview?: {
    workspaceFile?: string;
    noChangeMessage?: string;
  };
  releasePublisher?: {
    createGithubRelease?: boolean;
    afterRelease?: string[];
  };
}

const CONFIG_DIR = '.release-toolkit';
const CONFIG_FILE = 'config.json';

const DEFAULT_CONFIG: ReleaseToolkitConfig = {
  devBranch: 'dev',
  productionBranch: 'main',
  prLogCollector: {
    releaseLogMarker: {
      start: '<!-- RELEASE-LOG-START -->',
      end: '<!-- RELEASE-LOG-END -->',
    },
  },
  releasePreview: {
    workspaceFile: 'pnpm-workspace.yaml',
    noChangeMessage:
      '⚠️ 本次 PR 未检测到任何包的版本变更，合并后将不会触发发布。',
  },
  releasePublisher: {
    createGithubRelease: true,
    afterRelease: [],
  },
};

export function loadConfig(cwd?: string): ReleaseToolkitConfig {
  const basePath = cwd || process.cwd();
  const configPath = resolve(basePath, CONFIG_DIR, CONFIG_FILE);

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(raw) as Partial<ReleaseToolkitConfig>;
    return deepMerge(DEFAULT_CONFIG, userConfig);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function deepMerge<T extends Record<string, unknown>>(defaults: T, overrides: Partial<T>): T {
  const result = { ...defaults };
  for (const key of Object.keys(overrides) as Array<keyof T>) {
    const overrideValue = overrides[key];
    const defaultVal = result[key];

    if (
      overrideValue &&
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue) &&
      defaultVal &&
      typeof defaultVal === 'object' &&
      !Array.isArray(defaultVal)
    ) {
      result[key] = deepMerge(
        defaultVal as Record<string, unknown>,
        overrideValue as Record<string, unknown>,
      ) as T[keyof T];
    } else if (overrideValue !== undefined) {
      result[key] = overrideValue as T[keyof T];
    }
  }
  return result;
}

export { CONFIG_DIR, CONFIG_FILE, DEFAULT_CONFIG };
