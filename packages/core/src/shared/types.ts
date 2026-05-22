/**
 * Core 内部类型 barrel —— 单一来源为 `@release-toolkit/types`
 *
 * 历史上这里直接定义类型；为打破与 `@release-toolkit/changelog-presets`
 * 的循环依赖，所有类型已迁移至 `@release-toolkit/types`，本文件仅做 re-export
 * 以保持现有 import 路径稳定。
 */

export type {
  DiffType,
  PackageVersionInfo,
  VersionDiffResult,
  GithubContext,
  ChangelogEntry,
  ILineFormatter,
  ILogFormatter,
  ILogParser,
  IPlugin,
  ChangelogFormatter,
  LoadedPlugins,
  LoadPluginsResult,
  ReleaseHookContext,
  PRLogCollectorResult,
  ReleasePreviewResult,
  ReleasePublisherResult,
} from '@release-toolkit/types';
