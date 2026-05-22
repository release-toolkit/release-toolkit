/**
 * `@release-toolkit/types` — 共享 TypeScript 类型定义
 *
 * 该包仅包含类型，无任何运行时代码。
 * `@release-toolkit/core` 与 `@release-toolkit/changelog-presets` 均依赖本包，
 * 借此打破二者之间的循环依赖。
 */

// ==================== 版本检测 ====================

/** 版本差异类型 */
export type DiffType = 'major' | 'minor' | 'patch' | null;

/** 包版本信息 */
export interface PackageVersionInfo {
  packageName: string;
  packagePath: string;
  currentVersion: string;
  newVersion: string;
}

/** 版本差异结果 */
export interface VersionDiffResult {
  package: PackageVersionInfo;
  diffType: DiffType;
}

// ==================== GitHub 上下文 ====================

/** GitHub Actions / Worker 共用的执行上下文 */
export interface GithubContext {
  isGitHubActions: boolean;
  eventName: string;
  prNumber?: number;
  repoOwner?: string;
  repoName?: string;
  token?: string;
  baseRef?: string;
  headRef?: string;
}

// ==================== 插件相关 ====================

/** Changelog 条目 */
export interface ChangelogEntry {
  /** Commit 类型 */
  type: string;
  /** 作用域 */
  scope?: string;
  /** 主题描述 */
  subject: string;
  /** 原始行内容 */
  rawLine?: string;
  /** PR 编号 */
  prNumber?: number;
  /** Commit SHA */
  commitHash?: string;
}

/** 单行格式化接口 */
export interface ILineFormatter {
  /** 格式化器名称 */
  name: string;
  /** 格式化单行，返回格式化后的行 */
  formatLine(line: string): string;
  /** 可选：正则表达式匹配特定行 */
  linePattern?: RegExp;
}

/** 整体日志格式化接口 */
export interface ILogFormatter {
  /** 格式化器名称 */
  name: string;
  /** 格式化整个 changelog 文本 */
  format(log: string): string;
  /** 可选：处理分组 */
  groupBy?: (entry: ChangelogEntry) => string;
}

/** 自定义日志解析器 */
export interface ILogParser {
  /** 解析器名称 */
  name: string;
  /** 解析原始 changelog 文本为结构化条目 */
  parse(text: string): ChangelogEntry[];
  /** 可选：提取额外元数据 */
  extractMetadata?(entries: ChangelogEntry[]): Record<string, unknown>;
}

/** 日志格式化器（基础接口，兼容旧代码） */
export interface ChangelogFormatter {
  /** 格式化器名称，用于配置引用 */
  name: string;
  /** 整体格式化：将条目列表格式化为完整 changelog 文本 */
  format?: (entries: ChangelogEntry[]) => string;
  /** 单行格式化：对单行 changelog 文本进行格式化 */
  formatLine?: (line: string) => string;
}

/** 通用插件接口（支持生命周期钩子） */
export interface IPlugin {
  /** 插件名称 */
  name: string;
  /** 插件版本 */
  version?: string;

  // 生命周期钩子
  beforeCollect?(context: ReleaseHookContext): Promise<void>;
  afterCollect?(context: ReleaseHookContext, result: PRLogCollectorResult): Promise<void>;
  beforePreview?(context: ReleaseHookContext): Promise<void>;
  afterPreview?(context: ReleaseHookContext, result: ReleasePreviewResult): Promise<void>;
  beforePublish?(context: ReleaseHookContext): Promise<void>;
  afterPublish?(context: ReleaseHookContext, result: ReleasePublisherResult): Promise<void>;

  // 格式化器（兼容 ChangelogFormatter）
  format?: (entries: ChangelogEntry[]) => string;
  formatLine?: (line: string) => string;

  // 自定义日志解析
  parseLog?: (text: string) => ChangelogEntry[];
}

/** 加载后的插件集合 */
export interface LoadedPlugins {
  /** 格式化器数组 */
  formatters: ChangelogFormatter[];
  /** 加载错误信息 */
  errors: string[];
}

/** 加载插件结果（同时返回 IPlugin 和 ChangelogFormatter） */
export interface LoadPluginsResult {
  /** IPlugin 数组（支持生命周期钩子） */
  plugins: IPlugin[];
  /** 格式化器数组（兼容旧代码） */
  formatters: ChangelogFormatter[];
  /** 加载错误信息 */
  errors: string[];
}

// ==================== 钩子上下文 ====================

/** 发布钩子上下文 */
export interface ReleaseHookContext {
  packageName: string;
  oldVersion: string;
  newVersion: string;
  tagName: string;
}

// ==================== Feature 返回值 ====================

/** PR 日志收集结果 */
export interface PRLogCollectorResult {
  success: boolean;
  prNumber: number;
  prTitle: string;
  changelog: string;
  commentPosted: boolean;
  savedPath?: string;
  error?: string;
}

/** 发布预览结果 */
export interface ReleasePreviewResult {
  success: boolean;
  prNumber: number;
  hasVersionChange: boolean;
  versionDiffs: VersionDiffResult[];
  commentPosted: boolean;
  error?: string;
}

/** 发布器结果 */
export interface ReleasePublisherResult {
  success: boolean;
  releases: Array<{
    packageName: string;
    tagName: string;
    releaseUrl?: string;
  }>;
  errors: string[];
}
