import * as fs from 'node:fs';
import * as path from 'node:path';
import { CiRunnerOptions } from '../types.js';

/** Default config values (mirrors CiRunner constructor defaults) */
const DEFAULT_CONFIG: Required<Omit<CiRunnerOptions, 'afterRelease'>> & { afterRelease: string[] } = {
  baseRef: 'main',
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

/** Shape of the config.json file */
export interface ReleaseToolkitConfig {
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
