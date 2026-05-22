/** 无变更日志时的占位列表项 */
export const EMPTY_CHANGELOG_BULLET = '- （无对应的变更日志）';

/** 将文本行转为列表项；已以 `-` 开头的行不再重复添加前缀 */
export function toBulletLines(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    lines.push(trimmed.startsWith('-') ? trimmed : `- ${trimmed}`);
  }
  return lines;
}
