/**
 * 插件类型定义
 *
 * 重新导出 shared/types.ts 中的类型，保持向后兼容
 */

export type {
  ILineFormatter,
  ILogFormatter,
  ILogParser,
  IPlugin,
  ChangelogEntry,
  ChangelogFormatter,
  LoadedPlugins,
  LoadPluginsResult,
  ReleaseHookContext,
  PRLogCollectorResult,
  ReleasePreviewResult,
  ReleasePublisherResult,
} from '../types.js';
