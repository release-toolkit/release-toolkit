/**
 * App Server 评论 / PR 描述体组装（Worker-safe）
 *
 * 与 core 共用的纯函数见 `@release-toolkit/markdown`。
 */

import {
  COMMENT_ANCHOR_END,
  COMMENT_ANCHOR_START,
  EMPTY_CHANGELOG_BULLET,
  OUTPUT_END,
  OUTPUT_START,
  RELEASE_LOG_END,
  RELEASE_LOG_START,
  escapeRegex,
  extractReleaseLogFromBody,
  formatChangeLogBulletsPlain,
  formatTitleBulletWithEmoji,
  type PackageChangeLog,
} from '@release-toolkit/markdown';

export {
  COMMENT_ANCHOR_END,
  COMMENT_ANCHOR_START,
  OUTPUT_END,
  OUTPUT_START,
  RELEASE_LOG_END,
  RELEASE_LOG_START,
  type PackageChangeLog,
};

export interface VersionDiff {
  packageName: string;
  currentVersion: string;
  newVersion: string;
}

export interface PRContext {
  owner: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prBody: string | null;
  baseRef: string;
  headRef: string;
  headSha: string;
}

export interface OutputSections {
  notification: boolean;
  preview: boolean;
  editGuide: boolean;
}

export const DEFAULT_OUTPUT_SECTIONS: OutputSections = {
  notification: true,
  preview: true,
  editGuide: true,
};

export function mergeOutputSections(partial?: Partial<OutputSections>): OutputSections {
  return {
    notification: partial?.notification ?? DEFAULT_OUTPUT_SECTIONS.notification,
    preview: partial?.preview ?? DEFAULT_OUTPUT_SECTIONS.preview,
    editGuide: partial?.editGuide ?? DEFAULT_OUTPUT_SECTIONS.editGuide,
  };
}

export function outputSectionsFromRepoConfig(
  config: Record<string, unknown> | null | undefined,
): OutputSections | null {
  if (!config || typeof config !== 'object') return null;
  const prLog = config.prLogCollector;
  if (!prLog || typeof prLog !== 'object') return null;
  const sections = (prLog as { outputSections?: Partial<OutputSections> }).outputSections;
  if (!sections || typeof sections !== 'object') return null;
  return mergeOutputSections(sections);
}

export function resolveOutputSections(rawJson?: string): OutputSections {
  if (!rawJson) return { ...DEFAULT_OUTPUT_SECTIONS };
  try {
    const parsed = JSON.parse(rawJson) as Partial<OutputSections>;
    return mergeOutputSections(parsed);
  } catch (err) {
    console.warn('[outputSections] 无法解析 OUTPUT_SECTIONS，使用默认值:', err);
    return { ...DEFAULT_OUTPUT_SECTIONS };
  }
}

export type ExtractedReleaseLog = {
  rawReleaseLog: string | null;
  packageChangeLogs: PackageChangeLog[];
};

export function extractReleaseLog(body: string | null): ExtractedReleaseLog {
  const { rawReleaseLog, packageChangeLogs } = extractReleaseLogFromBody(body);
  return { rawReleaseLog, packageChangeLogs };
}

export function renderVersionDiffTable(diffs: VersionDiff[]): string {
  if (diffs.length === 0) return '_（无版本变更）_';
  const lines: string[] = [];
  lines.push('| 包名 | 当前版本 | 新版本 |');
  lines.push('| --- | --- | --- |');
  for (const d of diffs) {
    lines.push(`| \`${d.packageName}\` | ${d.currentVersion} | ${d.newVersion} |`);
  }
  return lines.join('\n');
}

function renderPackageSection(
  packageDir: string,
  packageDisplayName: string,
  prTitle: string,
  changeLog: string,
): string {
  const lines: string[] = [];
  const heading =
    packageDisplayName === packageDir
      ? `## ${packageDir}`
      : `## ${packageDisplayName}`;
  lines.push(heading);
  lines.push('');
  lines.push(formatTitleBulletWithEmoji(prTitle));
  for (const b of formatChangeLogBulletsPlain(changeLog)) {
    lines.push(b);
  }
  return lines.join('\n');
}

export function buildPreviewMarkdown(
  prCtx: PRContext,
  changedPackages: string[],
  versionDiffs: VersionDiff[],
  parsedLogs: PackageChangeLog[],
): string {
  const lines: string[] = [];

  lines.push(`# PR #${prCtx.prNumber} 变更日志`);
  lines.push('');

  lines.push('## 变更包列表：');
  lines.push('');
  if (changedPackages.length === 0) {
    lines.push('（无变更包）');
  } else {
    for (const pkg of changedPackages) {
      const diff = versionDiffs.find(
        (d) => d.packageName === pkg || d.packageName.endsWith(`/${pkg}`),
      );
      lines.push(
        diff
          ? `- \`${diff.packageName}\`：${diff.currentVersion} → ${diff.newVersion}`
          : `- \`${pkg}\``,
      );
    }
  }
  lines.push('');

  const logMap = new Map<string, string>();
  for (const { packages, changeLog } of parsedLogs) {
    if (packages.length === 0) {
      for (const pkg of changedPackages) logMap.set(pkg, changeLog);
    } else {
      for (const pkg of packages) logMap.set(pkg, changeLog);
    }
  }

  const targets = changedPackages.length > 0 ? changedPackages : ['__default__'];
  for (const pkg of targets) {
    const displayName =
      pkg === '__default__'
        ? '变更内容'
        : (versionDiffs.find(
            (d) => d.packageName === pkg || d.packageName.endsWith(`/${pkg}`),
          )?.packageName ?? pkg);
    lines.push(
      renderPackageSection(pkg, displayName, prCtx.prTitle, logMap.get(pkg) ?? ''),
    );
    lines.push('');
  }

  return lines.join('\n').trim();
}

export function buildEditGuide(): string {
  return `<details>
<summary>✏️ 如何修改变更日志</summary>

在 **PR 描述体** 中追加以下标记区（替换为你的真实内容）：

\`\`\`
${RELEASE_LOG_START}
## package-a
- feat: 自定义标题（标题）
- 新增功能说明
- 修复内容说明

## package-b
- 此处可省略标题，工具会自动使用 PR 标题
\`\`\`

> 若无 \`## 包名\` 分组，工具会把列表视为所有变更包的通用日志。
</details>`;
}

export function buildPRComment(input: {
  prCtx: PRContext;
  changedPackages: string[];
  versionDiffs: VersionDiff[];
  parsedLogs: PackageChangeLog[];
  sections: OutputSections;
  approved?: boolean;
}): string {
  const { prCtx, changedPackages, versionDiffs, parsedLogs, sections, approved } = input;
  const parts: string[] = [];

  if (sections.notification) {
    const status = approved
      ? '✅ **PR 已批准** —— 日志将写入 PR 描述体'
      : '📢 **PR 待审批**';
    parts.push(status);
    parts.push('');
    parts.push('### 变更包版本');
    parts.push('');
    parts.push(renderVersionDiffTable(versionDiffs));
  }

  if (sections.preview) {
    if (parts.length > 0) {
      parts.push('');
      parts.push('---');
      parts.push('');
    }
    parts.push(buildPreviewMarkdown(prCtx, changedPackages, versionDiffs, parsedLogs));
  }

  if (sections.editGuide) {
    if (parts.length > 0) {
      parts.push('');
      parts.push('---');
      parts.push('');
    }
    parts.push(buildEditGuide());
  }

  if (parts.length === 0) {
    parts.push('_release-toolkit: 所有输出区块均已关闭_');
  }

  return parts.join('\n');
}

export function buildConfirmedReleaseLog(
  prCtx: PRContext,
  changedPackages: string[],
  versionDiffs: VersionDiff[],
  parsedLogs: PackageChangeLog[],
): string {
  return [
    `# PR #${prCtx.prNumber} 变更日志（已确认）`,
    '',
    '> ✅ 此日志已通过 Review 确认，将用于发布 Release Notes',
    '',
    renderVersionDiffTable(versionDiffs),
    '',
    '---',
    '',
    buildPreviewMarkdown(prCtx, changedPackages, versionDiffs, parsedLogs),
  ].join('\n');
}

export function wrapOutputMarkers(content: string): string {
  return `${OUTPUT_START}\n${content}\n${OUTPUT_END}`;
}

export function upsertOutputInBody(currentBody: string | null, content: string): string {
  const body = currentBody ?? '';
  const wrapped = wrapOutputMarkers(content);
  if (body.includes(OUTPUT_START) && body.includes(OUTPUT_END)) {
    return body.replace(
      new RegExp(`${escapeRegex(OUTPUT_START)}[\\s\\S]*?${escapeRegex(OUTPUT_END)}`),
      wrapped,
    );
  }
  return body.trim() ? `${body}\n\n${wrapped}` : wrapped;
}

/** @deprecated 使用 formatTitleBulletWithEmoji */
export const formatTitleBullet = formatTitleBulletWithEmoji;

/** @deprecated 使用 formatChangeLogBulletsPlain */
export const formatChangeLogBullets = formatChangeLogBulletsPlain;

export {
  escapeRegex,
  toBulletLines,
  applyEmojiPrefixToLine as applyEmojiPrefix,
  parseReleaseLog,
  EMPTY_CHANGELOG_BULLET,
} from '@release-toolkit/markdown';
