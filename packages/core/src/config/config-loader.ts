import * as fs from 'node:fs';
import * as path from 'node:path';
import { CiRunnerOptions } from '../types.js';

/** Default config values (mirrors CiRunner constructor defaults) */
const DEFAULT_CONFIG: Required<Omit<CiRunnerOptions, 'afterRelease'>> & { afterRelease: string[]; devBranch: string } = {
  baseRef: 'main',
  devBranch: 'dev',
  changelogDir: '.changelog',
  outputPath: 'CHANGELOG.md',
  commentPr: true,
  dryRun: false,
  plugins: ['emoji-prefix', 'category-group', 'markdown-bold'],
  fileWriteMode: 'overwrite',
  createTags: true,
  createRelease: true,
  afterRelease: [],
};

/** Default PR changelog config */
const DEFAULT_PR_CONFIG: Required<PRChangelogConfig> = {
  packagesDir: 'packages',
  rootTag: 'root',
  packageMap: {},
};

/** PR-level changelog configuration */
export interface PRChangelogConfig {
  /** Directory name containing monorepo packages (for diff-based detection) */
  packagesDir?: string;
  /** Tag used when changes are outside any packages directory */
  rootTag?: string;
  /** Manual directory → package name mapping. e.g. { "core": "@releasetoolkit/core" } */
  packageMap?: Record<string, string>;
}

export interface ReleaseToolkitConfig {
  /** Development branch name. PRs targeting this branch trigger Stage 1 (save PR changelog). Default: 'dev' */
  devBranch?: string;
  /** Base/publish branch name. PRs targeting this branch trigger Stage 2 (preview). Merge to this branch triggers Stage 3 (publish). Default: 'main' */
  baseRef?: string;
  changelogDir?: string;
  outputPath?: string;
  commentPr?: boolean;
  dryRun?: boolean;
  plugins?: string[];
  fileWriteMode?: 'append' | 'overwrite';
  createTags?: boolean;
  createRelease?: boolean;
  afterRelease?: string[];
  /** PR-level changelog options */
  prChangelog?: PRChangelogConfig;
}

/** Directory name for .releasetoolkit */
export const CONFIG_DIR = '.releasetoolkit';

/** Config filename */
export const CONFIG_FILE = 'config.json';

/**
 * Initialize `.releasetoolkit/config.json` with a minimal template.
 *
 * - If file already exists, does nothing (returns false).
 * - Creates directory and writes minimal JSON (only fields that differ from defaults).
 *   Users can add more fields as needed — all fields have sensible defaults.
 */
export function initConfig(cwd: string): { created: boolean; path: string } {
  const dir = path.join(cwd, CONFIG_DIR);
  const filePath = path.join(dir, CONFIG_FILE);

  if (fs.existsSync(filePath)) {
    return { created: false, path: filePath };
  }

  fs.mkdirSync(dir, { recursive: true });

  // Minimal template: only include prChangelog section as example
  // (CI options all have good defaults; PR changelog config is the one users likely want to customize)
  const template: ReleaseToolkitConfig = {
    prChangelog: {
      packagesDir: 'packages',
      rootTag: 'root',
    },
  };

  fs.writeFileSync(filePath, JSON.stringify(template, null, 2) + '\n', 'utf-8');

  console.log(`[Config] Created ${CONFIG_DIR}/${CONFIG_FILE}`);

  return { created: true, path: filePath };
}

/**
 * Load CI config from `.releasetoolkit/config.json` in the given cwd.
 * Returns merged config: defaults ← config file ← explicit options (explicit wins).
 */
export function loadConfig(cwd: string, explicitOptions?: Partial<CiRunnerOptions>): Required<CiRunnerOptions> {
  const configPath = path.join(cwd, CONFIG_DIR, CONFIG_FILE);
  let fileConfig: ReleaseToolkitConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      fileConfig = JSON.parse(raw) as ReleaseToolkitConfig;
      console.log(`[ConfigLoader] Loaded config from ${CONFIG_DIR}/${CONFIG_FILE}`);
    } catch (error) {
      console.warn(`[ConfigLoader] Failed to parse ${CONFIG_DIR}/${CONFIG_FILE}, using defaults: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Merge: defaults ← file config ← explicit options
  return {
    baseRef: explicitOptions?.baseRef ?? fileConfig.baseRef ?? DEFAULT_CONFIG.baseRef,
    devBranch: explicitOptions?.devBranch ?? fileConfig.devBranch ?? DEFAULT_CONFIG.devBranch,
    changelogDir: explicitOptions?.changelogDir ?? fileConfig.changelogDir ?? DEFAULT_CONFIG.changelogDir,
    outputPath: explicitOptions?.outputPath ?? fileConfig.outputPath ?? DEFAULT_CONFIG.outputPath,
    commentPr: explicitOptions?.commentPr ?? fileConfig.commentPr ?? DEFAULT_CONFIG.commentPr,
    dryRun: explicitOptions?.dryRun ?? fileConfig.dryRun ?? DEFAULT_CONFIG.dryRun,
    plugins: explicitOptions?.plugins ?? fileConfig.plugins ?? DEFAULT_CONFIG.plugins,
    fileWriteMode: explicitOptions?.fileWriteMode ?? fileConfig.fileWriteMode ?? DEFAULT_CONFIG.fileWriteMode,
    createTags: explicitOptions?.createTags ?? fileConfig.createTags ?? DEFAULT_CONFIG.createTags,
    createRelease: explicitOptions?.createRelease ?? fileConfig.createRelease ?? DEFAULT_CONFIG.createRelease,
    afterRelease: explicitOptions?.afterRelease ?? fileConfig.afterRelease ?? DEFAULT_CONFIG.afterRelease,
  };
}

/**
 * Load PR changelog-specific config from `.releasetoolkit/config.json`.
 * Returns merged config with defaults applied.
 */
export function loadPRChangelogConfig(cwd?: string): Required<PRChangelogConfig> {
  const targetCwd = cwd || process.cwd();
  const configPath = path.join(targetCwd, CONFIG_DIR, CONFIG_FILE);
  let prCfg: PRChangelogConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw) as ReleaseToolkitConfig;
      prCfg = parsed.prChangelog || {};
    } catch {
      // ignore parse errors, use defaults
    }
  }

  return {
    packagesDir: prCfg.packagesDir ?? DEFAULT_PR_CONFIG.packagesDir,
    rootTag: prCfg.rootTag ?? DEFAULT_PR_CONFIG.rootTag,
    packageMap: { ...DEFAULT_PR_CONFIG.packageMap, ...prCfg.packageMap },
  };
}
