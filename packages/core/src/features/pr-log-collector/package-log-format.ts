import type { ChangelogFormatter } from '../../shared/plugins/types.js';
import { applyFormatters, applyFormatLine, parseChangelog } from '../../shared/plugins/index.js';
import {
  formatChangeLogBulletsFromBody,
  formatTitleBulletLine,
  toBulletLines,
} from '@release-toolkit/markdown';

export { toBulletLines } from '@release-toolkit/markdown';

function applyFormatLineChain(
  line: string,
  formatters: ChangelogFormatter[],
): string {
  let result = line;
  for (const formatter of formatters) {
    if (formatter.formatLine) {
      result = formatter.formatLine(result);
    }
  }
  return result;
}

/** PR 标题行：`- {title}（标题）`，并应用 formatLine 插件 */
export function formatTitleBullet(
  title: string,
  formatters: ChangelogFormatter[],
): string {
  const formatLine =
    formatters.length > 0
      ? (line: string) => applyFormatLineChain(line, formatters)
      : undefined;
  return formatTitleBulletLine(title, formatLine);
}

/** 变更日志内容行：解析 + 插件格式化，再转为列表项 */
export function formatChangeLogBullets(
  changeLog: string,
  formatters: ChangelogFormatter[],
): string[] {
  return formatChangeLogBulletsFromBody(changeLog, (trimmed) => {
    const entries = parseChangelog(trimmed);
    if (entries.length > 0) {
      return applyFormatters(entries, formatters);
    }
    return applyFormatLine(trimmed, formatters);
  });
}
