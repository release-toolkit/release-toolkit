/**
 * 公共工具函数
 */

/**
 * 检测是否在 Cloudflare Worker 环境
 *
 * 优先依据 Cloudflare 官方设定的 `navigator.userAgent === 'Cloudflare-Workers'`，
 * 其次回退到 `process` 缺失的判断，避免误把 Node 当成 Worker。
 */
export const IS_WORKER = (() => {
  try {
    const nav = (globalThis as unknown as { navigator?: { userAgent?: string } }).navigator;
    if (nav?.userAgent === 'Cloudflare-Workers') return true;
  } catch {
    // ignore
  }
  return typeof (globalThis as unknown as { process?: { versions?: { node?: string } } }).process?.versions?.node !== 'string';
})();

export {
  OUTPUT_MARKERS,
  OUTPUT_START,
  OUTPUT_END,
  escapeRegex,
  wrapOutputMarkers,
  upsertOutputInBody,
} from '@release-toolkit/markdown';

/**
 * 解析 GitHub 仓库路径
 */
export function parseGithubRepository(repo?: string): { owner: string; repo: string } {
  if (!repo) return { owner: '', repo: '' };
  const [owner, name] = repo.split('/');
  return { owner, repo: name || '' };
}
