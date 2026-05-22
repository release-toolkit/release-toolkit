import { applyEmojiPrefixToLine } from './emoji.js';

/** `- {title}（标题）`，可选对整行做 formatLine（如 changelog 插件） */
export function formatTitleBulletLine(
  title: string,
  formatLine?: (line: string) => string,
): string {
  let line = `- ${title}（标题）`;
  if (formatLine) {
    line = formatLine(line);
  }
  return line;
}

/** App Server 等无插件场景：标题行 + 内置 emoji */
export function formatTitleBulletWithEmoji(title: string): string {
  return applyEmojiPrefixToLine(`- ${title}（标题）`);
}
