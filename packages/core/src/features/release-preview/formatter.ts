import type { PackageVersionDiff } from './types.js';
import type { ChangelogFormatter } from '../../shared/plugins/types.js';
import { applyFormatters, parseChangelog } from '../../shared/plugins/index.js';

export function formatReleasePreviewComment(
  hasVersionChange: boolean,
  versionDiffs: PackageVersionDiff[],
  aggregatedLog: string,
  noChangeMessage: string,
  formatters: ChangelogFormatter[] = [],
): string {
  const lines: string[] = [];
  lines.push('## 🚀 版本发布预览');
  lines.push('');

  if (!hasVersionChange) {
    lines.push(noChangeMessage);
    lines.push('');
    lines.push('---');
    lines.push(`*由 release-toolkit 自动生成，最后更新：${new Date().toISOString().split('T')[0]}*`);
    return lines.join('\n');
  }

  lines.push('### 版本变更');
  lines.push('');
  lines.push('| 包名 | 旧版本 | 新版本 | 变更类型 |');
  lines.push('| ------ | -------- | -------- | -------- |');

  for (const d of versionDiffs) {
    lines.push(`| ${d.packageName} | ${d.oldVersion} | ${d.newVersion} | ${d.diffType ?? '未知'} |`);
  }

  lines.push('');
  lines.push('### 变更日志');
  lines.push('');

  // 应用插件格式化
  if (formatters.length > 0) {
    const formattedLog = applyFormattersToAggregatedLog(aggregatedLog, formatters);
    lines.push(formattedLog);
  } else {
    lines.push(aggregatedLog);
  }

  lines.push('');
  lines.push('---');
  lines.push(`*由 release-toolkit 自动生成，最后更新：${new Date().toISOString().split('T')[0]}*`);

  return lines.join('\n');
}

/** 对聚合日志应用格式化器 */
function applyFormattersToAggregatedLog(log: string, formatters: ChangelogFormatter[]): string {
  // 按 PR 分割日志
  const prSections = log.split(/(?=### PR #\d+:)/);
  const formattedSections: string[] = [];

  for (const section of prSections) {
    if (!section.trim()) continue;

    // 提取 PR 标题行和内容
    const match = section.match(/^(### PR #\d+: .+)\n([\s\S]*)/);
    if (!match) {
      formattedSections.push(section);
      continue;
    }

    const [, titleLine, content] = match;
    const entries = parseChangelog(content);
    const formattedContent = applyFormatters(entries, formatters);

    formattedSections.push(`${titleLine}\n${formattedContent}`);
  }

  return formattedSections.join('\n');
}
