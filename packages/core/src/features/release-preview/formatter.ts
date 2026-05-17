import type { VersionDiffResult } from '../../shared/types.js';
import type { ChangelogFormatter } from '../../shared/plugins/types.js';
import { applyFormatters, parseChangelog } from '../../shared/plugins/index.js';

/**
 * 格式化 Release Preview 评论
 * 结构分为三部分：欢迎信息、预览/发布日志、操作提示
 * @param isMerged - PR 是否已合并，决定显示预览提示还是正式发布信息
 */
export function formatReleasePreviewComment(
  hasVersionChange: boolean,
  versionDiffs: VersionDiffResult[],
  aggregatedLog: string,
  noChangeMessage: string,
  formatters: ChangelogFormatter[] = [],
  isMerged: boolean = false,
): string {
  const today = new Date().toISOString().split('T')[0];
  const lines: string[] = [];

  // ==================== 第一部分：欢迎信息 ====================
  lines.push('');
  lines.push('Release Toolkit 已就绪 🎉');
  lines.push('');
  lines.push('感谢使用 release-toolkit，为你的 PR 提供自动化发布支持。');
  lines.push('');
  lines.push('---');
  lines.push('');

  // ==================== 第二部分：预览/发布日志（重点） ====================
  if (isMerged) {
    // 已合并：显示正式发布信息
    lines.push('## 📦 发布信息');
    lines.push('');
  } else {
    // 未合并：显示预览信息
    lines.push('## 📋 发布预览（Preview）');
    lines.push('');
    lines.push('> ⚠️ 以下为发布预览信息，**尚未确认发布**。合并 PR 并 Approve 后将正式触发发布流程。');
    lines.push('');
  }

  if (!hasVersionChange) {
    lines.push(noChangeMessage);
  } else {
    lines.push('### 版本变更');
    lines.push('');
    lines.push('| 包名 | 旧版本 | 新版本 | 变更类型 |');
    lines.push('| ------ | -------- | -------- | -------- |');

    for (const d of versionDiffs) {
      const diffType = d.diffType ?? '未知';
      lines.push(`| ${d.package.packageName} | ${d.package.currentVersion} | ${d.package.newVersion} | ${diffType} |`);
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
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // ==================== 第三部分：操作提示 ====================
  if (isMerged) {
    // 已合并：显示发布确认信息
    lines.push('### 状态');
    lines.push('');
    lines.push('- ✅ PR 已合并，等待发布确认');
    lines.push('');
  } else {
    // 未合并：显示操作提示
    lines.push('### 操作提示');
    lines.push('');
    lines.push('- 需要你对 PR 进行批准（Approve）');
    lines.push('- 如需修改变更日志，请编辑 PR 描述：');
    lines.push('');
    lines.push('```');
    lines.push('<!-- RELEASE-LOG-START -->');
    lines.push('你的额外变更说明...');
    lines.push('<!-- RELEASE-LOG-END -->');
    lines.push('```');
    lines.push('');
  }

  lines.push(`*由 release-toolkit 自动生成，最后更新：${today}*`);

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
