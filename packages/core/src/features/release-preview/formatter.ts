import type { PackageVersionDiff } from './types.js';

export function formatReleasePreviewComment(
  hasVersionChange: boolean,
  versionDiffs: PackageVersionDiff[],
  aggregatedLog: string,
  noChangeMessage: string,
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
  lines.push(aggregatedLog);
  lines.push('');
  lines.push('---');
  lines.push(`*由 release-toolkit 自动生成，最后更新：${new Date().toISOString().split('T')[0]}*`);

  return lines.join('\n');
}
