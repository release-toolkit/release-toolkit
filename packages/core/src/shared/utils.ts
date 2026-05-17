/**
 * 公共工具函数
 */

/** 检测是否在 Cloudflare Worker 环境 */
export const IS_WORKER = typeof globalThis !== 'undefined' && 'env' in globalThis as unknown as Record<string, unknown>;

/** 输出标记常量 */
export const OUTPUT_MARKERS = {
  START: '<!-- RELEASE-TOOLKIT-OUTPUT-START -->',
  END: '<!-- RELEASE-TOOLKIT-OUTPUT-END -->',
} as const;

/**
 * 转义正则表达式特殊字符
 */
export function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 解析 GitHub 仓库路径
 */
export function parseGithubRepository(repo?: string): { owner: string; repo: string } {
  if (!repo) return { owner: '', repo: '' };
  const [owner, name] = repo.split('/');
  return { owner, repo: name || '' };
}
