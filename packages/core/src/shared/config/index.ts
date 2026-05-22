import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

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
  type?: 'command' | 'npm-publish' | 'custom' | 'script' | 'package';
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
  /** 创建 Tag 前钩子 */
  beforeTag?: AfterReleaseHook[];
  /** 发布后钩子 */
  afterRelease?: AfterReleaseHook[];
}

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

export function loadConfig(cwd?: string): ReleaseToolkitConfig {
  const basePath = cwd || process.cwd();
  const configPath = resolve(basePath, CONFIG_DIR, CONFIG_FILE);

  if (!existsSync(configPath)) {
    return { ...DEFAULT_CONFIG };
  }

  try {
    const raw = readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(raw) as unknown as Record<string, unknown>;
    const merged = deepMerge(DEFAULT_CONFIG, userConfig);
    return merged as unknown as ReleaseToolkitConfig;
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG)) as ReleaseToolkitConfig;
  }
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

export { CONFIG_DIR, CONFIG_FILE, DEFAULT_CONFIG };
