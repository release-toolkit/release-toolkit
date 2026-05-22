import type { PRLogCollectorResult } from '../../shared/types.js';

// 复用 shared/types.ts 中的统一定义，避免与 collector.ts 的实际返回值漂移
export type { PRLogCollectorResult };

export interface PRLogCollectorOptions {
  prNumber: number;
  owner: string;
  repo: string;
  token?: string;
  cwd?: string;
  /** 配置文件路径，相对 cwd 或绝对路径 */
  configPath?: string;
  save?: boolean;
}

export interface PRMeta {
  number: number;
  title: string;
  body: string | null;
  baseRef: string;
  headRef: string;
}
