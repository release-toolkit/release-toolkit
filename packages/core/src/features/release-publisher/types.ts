import type { ReleaseHookContext, ReleasePublisherResult } from '../../shared/types.js';
import type { AfterReleaseHook, HookCommand } from '../../shared/config/index.js';

// 复用 shared/types.ts 中的统一定义
export type { ReleaseHookContext, ReleasePublisherResult, AfterReleaseHook, HookCommand };

export interface ReleasePublisherOptions {
  cwd?: string;
  /** 配置文件路径，相对 cwd 或绝对路径 */
  configPath?: string;
  dryRun?: boolean;
  owner?: string;
  repo?: string;
  token?: string;
}
