export function formatPRLogComment(
  title: string,
  releaseLog: string | null,
): string {
  const lines: string[] = [];
  lines.push('## 📋 PR 变更日志');
  lines.push('');
  lines.push(`**PR 标题：** ${title}`);
  lines.push('');

  if (releaseLog) {
    lines.push('**详细说明：**');
    lines.push('');
    lines.push(releaseLog);
  } else {
    lines.push('> 暂无详细说明（`RELEASE-LOG` 标记区未填写）。');
  }

  lines.push('');
  lines.push('---');
  lines.push(`*由 release-toolkit 自动生成，最后更新：${new Date().toISOString().split('T')[0]}*`);

  return lines.join('\n');
}
