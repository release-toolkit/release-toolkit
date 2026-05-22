import type { ChangelogFormatter } from '../../shared/plugins/types.js';
import { applyFormatters, applyFormatLine, parseChangelog } from '../../shared/plugins/index.js';

/** 将文本行转为列表项；已以 `-` 开头的行不再重复添加前缀 */
export function toBulletLines(text: string): string[] {
  const lines: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    lines.push(trimmed.startsWith('-') ? trimmed : `- ${trimmed}`);
  }
  return lines;
}

/** PR 标题行：`- {title}（标题）`，并应用 formatLine 插件 */
export function formatTitleBullet(
  title: string,
  formatters: ChangelogFormatter[],
): string {
  let line = `- ${title}（标题）`;
  for (const formatter of formatters) {
    if (formatter.formatLine) {
      line = formatter.formatLine(line);
    }
  }
  return line;
}

/** 变更日志内容行：解析 + 插件格式化，再转为列表项 */
export function formatChangeLogBullets(
  changeLog: string,
  formatters: ChangelogFormatter[],
): string[] {
  const trimmed = changeLog.trim();
  if (!trimmed) {
    return ['- （无对应的变更日志）'];
  }

  const entries = parseChangelog(trimmed);
  let body: string;
  if (entries.length > 0) {
    body = applyFormatters(entries, formatters);
  } else {
    body = applyFormatLine(trimmed, formatters);
  }

  const bullets = toBulletLines(body.trim() ? body : trimmed);
  return bullets.length > 0 ? bullets : ['- （无对应的变更日志）'];
}
