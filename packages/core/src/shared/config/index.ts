import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/**
 * Hook 执行方式
 */
export interface HookCommand {
  /** 执行方式 */
  type: 'command' | 'script' | 'package';
  /** Shell 命令（type: command） */
  command?: string;
  /** 脚本文件路径（type: script） */
  script?: string;
  /** npm 包名称（type: package） */
  name?: string;
  /** 包的 CLI 参数 */
  args?: string[];
}

/**
 * 生命周期钩子配置
 */
export interface LifecycleHook {
  /** 钩子执行方式 */
  run: HookCommand;
  /** Webhook 配置（可选） */
  webhook?: {
    url: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
    headers?: Record<string, string>;
    body?: string;
  };
  /** 通知配置（可选） */
  notify?: {
    type: 'slack' | 'discord' | 'custom';
    webhookUrl?: string;
    message?: string;
    channel?: string;
    headers?: Record<string, string>;
  };
}

/**
 * 发布后钩子配置（兼容旧配置）
 */
export interface AfterReleaseHook {
  /** 钩子类型（旧格式，推荐使用 run） */
  type?:
    | 'command'
    | 'npm-publish'
    | 'custom'
    | 'script'
    | 'package'
    | 'webhook'
    | 'slack'
    | 'discord';
  /** 新格式：钩子执行方式 */
  run?: HookCommand;
  /** 执行命令（npm-publish / custom / script 类型使用） */
  command?: string;
  /** 脚本文件路径（script 类型使用） */
  script?: string;
  /** npm 包名称（package 类型使用） */
  name?: string;
  /** 包的 CLI 参数 */
  args?: string[];
  /** Webhook URL（webhook 类型使用） */
  url?: string;
  /** HTTP 方法（webhook 类型使用，默认 POST） */
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** 请求头（webhook 类型使用） */
  headers?: Record<string, string>;
  /** 请求体（webhook 类型使用） */
  body?: string;
  /** Slack 频道（slack 类型使用） */
  channel?: string;
  /** Slack 消息内容 */
  message?: string;
  /** Discord Webhook URL（discord 类型使用） */
  webhookUrl?: string;
  /** Discord 消息内容 */
  discordMessage?: string;
  /** 与 LifecycleHook 对齐：主 run 执行后的附加 webhook */
  webhook?: LifecycleHook['webhook'];
  /** 与 LifecycleHook 对齐：主 run 执行后的附加通知 */
  notify?: LifecycleHook['notify'];
}

/**
 * Git Tag 格式配置
 */
export interface GitTagsConfig {
  /** Tag 格式，支持 {packageName} 和 {version} 占位符 */
  format: string;
  /** Release message 格式 */
  message: string;
}

/**
 * 分支配置（对象格式，便于后续扩展）
 */
export interface BranchesConfig {
  /** 目标分支（PR 日志收集、版本预览与发布共用） */
  base: string;
}

/**
 * PR 日志收集器配置
 */
export interface PRLogCollectorConfig {
  /** Release log 标记 */
  releaseLogMarker?: {
    start: string;
    end: string;
  };
  /** 输出区块控制 */
  outputSections?: {
    notification: boolean;
    preview: boolean;
    editGuide: boolean;
  };
  /** 日志提取配置 */
  logExtraction?: {
    source: 'comment' | 'pr-body';
    commentPosition?: 'first' | 'latest';
  };
  /**
   * 自定义日志解析器名称（内置 `'default'`，或模块名/文件路径）。
   * 用于替换默认的 parseChangelog 解析逻辑。
   */
  logParser?: string;
}

/**
 * 发布预览配置
 */
export interface ReleasePreviewConfig {
  /** Monorepo 配置文件 */
  workspaceFile: string;
  /** 无版本变更时的提示 */
  noChangeMessage: string;
  /** 预览输出配置 */
  previewOutput?: {
    showVersionDiff: boolean;
    showPackageList: boolean;
    showChangelog: boolean;
  };
}

/**
 * 发布器配置
 */
export interface ReleasePublisherConfig {
  /** 是否创建 GitHub Release */
  createGithubRelease: boolean;
  /** Git Tag 格式配置 */
  gitTags?: GitTagsConfig;
  /** 创建 Tag 前钩子（支持 LifecycleHook 格式） */
  beforeTag?: PublisherHookConfig[];
  /** 发布后钩子（支持 LifecycleHook 格式） */
  afterRelease?: PublisherHookConfig[];
}

/** 配置文件中 beforeTag / afterRelease 数组项类型 */
export type PublisherHookConfig = AfterReleaseHook | LifecycleHook;

/**
 * Release Toolkit 完整配置类型
 */
export interface ReleaseToolkitConfig {
  /** 分支配置 */
  branches: BranchesConfig;
  /** PR 日志收集器配置 */
  prLogCollector: PRLogCollectorConfig;
  /** 发布预览配置 */
  releasePreview: ReleasePreviewConfig;
  /** 发布器配置 */
  releasePublisher: ReleasePublisherConfig;
  /** 插件列表 */
  plugins: string[];
}

const CONFIG_DIR = '.release-toolkit';
const CONFIG_FILE = 'config.json';
/** 本地覆盖配置目录（与主配置同级，用于开发环境覆盖，优先级最高） */
const LOCAL_CONFIG_DIR = '.local';
const LOCAL_CONFIG_FILE = 'config.json';

const DEFAULT_CONFIG: ReleaseToolkitConfig = {
  branches: {
    base: 'dev',
  },
  prLogCollector: {
    releaseLogMarker: {
      start: '<!-- RELEASE-LOG-START -->',
      end: '<!-- RELEASE-LOG-END -->',
    },
    outputSections: {
      notification: true,
      preview: true,
      editGuide: true,
    },
    logExtraction: {
      source: 'comment',
      commentPosition: 'first',
    },
    logParser: 'default',
  },
  releasePreview: {
    workspaceFile: 'pnpm-workspace.yaml',
    noChangeMessage:
      '⚠️ 本次 PR 未检测到任何包的版本变更，合并后将不会触发发布。',
    previewOutput: {
      showVersionDiff: true,
      showPackageList: true,
      showChangelog: true,
    },
  },
  releasePublisher: {
    createGithubRelease: true,
    gitTags: {
      format: '{packageName}@{version}',
      message: 'Release {packageName}@{version}',
    },
    afterRelease: [],
  },
  plugins: ['emoji-prefix', 'category-group', 'markdown-bold'],
};

export interface LoadConfigOptions {
  /** 工作目录，用于解析相对 configPath */
  cwd?: string;
  /** 配置文件绝对或相对路径，默认 `<cwd>/.release-toolkit/config.json` */
  configPath?: string;
  /**
   * 是否启用本地覆盖配置 `.local/config.json`（与主配置同级）。
   * 默认 true。禁用后仅加载主配置文件。
   */
  localOverrides?: boolean;
}

export function loadConfig(cwd?: string): ReleaseToolkitConfig;
export function loadConfig(options: LoadConfigOptions): ReleaseToolkitConfig;
export function loadConfig(
  cwdOrOptions?: string | LoadConfigOptions,
): ReleaseToolkitConfig {
  const basePath =
    typeof cwdOrOptions === 'string'
      ? cwdOrOptions
      : cwdOrOptions?.cwd || process.cwd();
  const configPath =
    typeof cwdOrOptions === 'object' && cwdOrOptions?.configPath
      ? resolve(basePath, cwdOrOptions.configPath)
      : resolve(basePath, CONFIG_DIR, CONFIG_FILE);
  const enableLocal =
    typeof cwdOrOptions !== 'object' || cwdOrOptions?.localOverrides !== false;

  /**
   * 合并配置：默认配置 ← 主配置 ← 本地覆盖配置（后者优先级更高）。
   * 任一配置缺失时跳过，任一解析失败时给出告警并继续用其余配置。
   */
  const loadAndMerge = (
    from: Record<string, unknown>,
    path: string,
  ): Record<string, unknown> => {
    try {
      const raw = readFileSync(path, 'utf-8');
      const parsed = JSON.parse(raw) as unknown as Record<string, unknown>;
      return deepMerge(from, parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[release-toolkit] 配置文件 ${path} 读取或解析失败，已跳过：${msg}`,
      );
      return from;
    }
  };

  // 1. 主配置（如缺失则跳过，保持默认配置）
  let merged = JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as unknown as Record<
    string,
    unknown
  >;
  if (existsSync(configPath)) {
    merged = loadAndMerge(merged, configPath);
  }

  // 2. 本地覆盖配置 `.local/config.json`（与主配置同级，优先级最高）
  if (enableLocal) {
    const localPath = resolve(dirname(configPath), LOCAL_CONFIG_DIR, LOCAL_CONFIG_FILE);
    if (existsSync(localPath)) {
      merged = loadAndMerge(merged, localPath);
    }
  }

  return merged as unknown as ReleaseToolkitConfig;
}

function deepMerge(
  defaults: unknown,
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (defaults && typeof defaults === 'object') {
    Object.assign(result, defaults);
  }
  for (const key of Object.keys(overrides)) {
    const overrideValue = overrides[key];
    const defaultVal = result[key];

    if (
      overrideValue !== undefined &&
      typeof overrideValue === 'object' &&
      !Array.isArray(overrideValue) &&
      defaultVal !== undefined &&
      typeof defaultVal === 'object' &&
      !Array.isArray(defaultVal)
    ) {
      // 递归合并对象
      result[key] = deepMerge(
        defaultVal as Record<string, unknown>,
        overrideValue as Record<string, unknown>,
      );
    } else if (overrideValue !== undefined) {
      result[key] = overrideValue;
    }
  }
  return result;
}

export {
  applyGitTagTemplate,
  resolveGitTagName,
  resolveGitTagMessage,
} from './git-tag-format.js';
export { CONFIG_DIR, CONFIG_FILE, LOCAL_CONFIG_DIR, DEFAULT_CONFIG };
