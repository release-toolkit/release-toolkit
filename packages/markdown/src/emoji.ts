/** Conventional commit type → emoji（与 changelog-presets 保持一致） */
export const COMMIT_TYPE_EMOJI: Record<string, string> = {
  feat: '✨',
  fix: '🐛',
  docs: '📝',
  style: '💄',
  refactor: '♻️',
  perf: '⚡️',
  test: '✅',
  build: '📦️',
  ci: '👷',
  chore: '🔧',
  revert: '⏪️',
};

/**
 * 为 conventional commit 行添加 emoji。
 * 匹配 `type[(scope)]:`，允许行首有 `- `（emoji 插在 type 前，而非 dash 前）。
 */
export function applyEmojiPrefixToLine(line: string): string {
  const match = line.match(/(\w+)(?:\([^)]+\))?:/);
  if (!match) return line;
  const emoji = COMMIT_TYPE_EMOJI[match[1]];
  if (!emoji || line.includes(emoji)) return line;
  return line.replace(match[0], `${emoji} ${match[0]}`);
}
