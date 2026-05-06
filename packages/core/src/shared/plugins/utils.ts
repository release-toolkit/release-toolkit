/**
 * 解析 changelog 文本为结构化条目
 */
export function parseChangelog(
  text: string,
): Array<{ type: string; scope?: string; subject: string }> {
  const entries: Array<{ type: string; scope?: string; subject: string }> = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) continue;

    const content = trimmed.slice(2);
    const match = content.match(/^(\w+)(?:\(([^)]+)\))? (.+)$/);
    if (match) {
      entries.push({
        type: match[1],
        scope: match[2],
        subject: match[3],
      });
    } else {
      // 无法解析，作为普通条目
      entries.push({
        type: 'other',
        subject: content,
      });
    }
  }

  return entries;
}
