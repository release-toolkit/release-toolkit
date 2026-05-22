/**
 * 统一 CLI 输出格式
 *
 * 使用 picocolors（自动遵循 `NO_COLOR` 与 TTY 检测，CI 输出会自动去色）。
 */

import pc from 'picocolors';

export interface Logger {
  info(msg: string): void;
  success(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  detail(msg: string): void;
}

/** 创建带前缀的 logger，例如 `createLogger('collect')` → `[release collect]` */
export function createLogger(name: string): Logger {
  const tag = pc.blue(`[release ${name}]`);
  return {
    info: (msg) => console.log(`${tag} ${msg}`),
    success: (msg) => console.log(`${tag} ${pc.green('✓')} ${msg}`),
    warn: (msg) => console.warn(`${tag} ${pc.yellow('!')} ${msg}`),
    error: (msg) => console.error(`${tag} ${pc.red('✗')} ${msg}`),
    detail: (msg) => console.log(`${tag} ${pc.dim('  ↳')} ${msg}`),
  };
}
