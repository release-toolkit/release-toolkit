import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { diffFiles } from '../../shared/git/git-reader.js';
import { loadConfig } from '../../shared/config/index.js';
import type { GithubContext } from '../../shared/types.js';
import type { ReleaseToolkitConfig } from '../../shared/config/index.js';
import { getPR, updatePR } from '../../shared/github/api-client.js';
import { extractReleaseLog, type PackageChangeLog } from './release-log-extractor.js';
import type { PRLogCollectorOptions, PRLogCollectorResult, PRMeta } from './types.js';
import { loadPlugins, applyFormatters, parseChangelog } from '../../shared/plugins/index.js';

const OUTPUT_START = '<!-- RELEASE-TOOLKIT-OUTPUT-START -->';
const OUTPUT_END = '<!-- RELEASE-TOOLKIT-OUTPUT-END -->';

/** 生成标记区的用户指南（使用引用格式，用户可见） */
function generateSpecExplanation(): string {
  const lines: string[] = [
    '> 📖 **RELEASE-TOOLKIT 输出说明**',
    '>',
    '> - 部分包共享日志，部分包独立：',
    '> ```',
    '> ## package-a, package-b',
    '> ### 变更日志',
    '> - 共同的变更内容',
    '>',
    '> ## package-c',
    '> ### 变更日志',
    '> - package-c 的独立变更',
    '> ```',
    '>',
    '> - 无包名声明（基于 `git diff packages/*/package.json`）：',
    '> ```',
    '> ### 变更日志',
    '> - 所有变更包的通用变更内容',
    '> ```',
    '>',
    '> ⚠️ 此区域由工具自动生成和维护，请勿手动编辑',
    '>',
    '',
  ];

  return lines.join('\n');
}

/** GitHub REST API 返回的 PR 数据结构（部分字段） */
type GitHubPRResponse = {
  number: number;
  title: string;
  body: string | null;
  base_ref: string;
  head_ref: string;
};

async function fetchPRMeta(context: GithubContext, _config: ReleaseToolkitConfig): Promise<PRMeta> {
  const { data } = await getPR(context);

  // getPR 返回 Record<string, unknown>，此处做单次类型断言
  // 对应 GitHub REST API /pulls/{pull_number} 响应的已知字段
  const prData = data as GitHubPRResponse;

  return {
    number: prData.number,
    title: prData.title,
    body: prData.body ?? null,
    baseRef: prData.base_ref,
    headRef: prData.head_ref,
  };
}

export async function collectPRLog(options: PRLogCollectorOptions): Promise<PRLogCollectorResult> {
  const context: GithubContext = {
    isGitHubActions: true,
    eventName: 'pull_request',
    prNumber: options.prNumber,
    repoOwner: options.owner,
    repoName: options.repo,
    token: options.token,
  };

  try {
    const config = loadConfig(options.cwd);

    const meta = await fetchPRMeta(context, config);
    const { packageChangeLogs, rawReleaseLog } = extractReleaseLog(
      meta.body,
      config,
    );

    // 生成结构化 Markdown
    const markdown = await generateStructuredMarkdown(
      meta.number,
      meta.title,
      packageChangeLogs,
      meta.baseRef,
      meta.headRef,
      options.cwd,
    );

    // 更新 PR 描述体（幂等）
    const updatedBody = updatePRBody(meta.body, markdown);
    console.log('[collect] 准备更新 PR 描述体，长度:', updatedBody.length);
    try {
      await updatePR(context, updatedBody);
      console.log('[collect] ✅ PR 描述体更新成功');
    } catch (updateErr) {
      console.error('[collect] ❌ PR 描述体更新失败:', updateErr);
      throw updateErr;
    }

    // 保存快照到 .release-toolkit/releases/
    let savedPath: string | undefined;
    if (options.save) {
      savedPath = await saveSnapshot(meta.number, meta.title, rawReleaseLog, markdown, options.cwd);
    }

    return {
      success: true,
      prNumber: meta.number,
      title: meta.title,
      releaseLog: rawReleaseLog,
      commentPosted: true,
      savedPath,
    };
  } catch (err) {
    return {
      success: false,
      prNumber: options.prNumber,
      title: '',
      releaseLog: null,
      commentPosted: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** 生成结构化的 Markdown 文档（按变更包分组）*/
async function generateStructuredMarkdown(
  prNumber: number,
  title: string,
  packageChangeLogs: PackageChangeLog[],
  baseRef: string,
  headRef: string,
  cwd?: string,
): Promise<string> {
  const base = cwd || process.cwd();
  const changedPackages = await detectChangedPackages(baseRef, headRef, base);
  const config = loadConfig(cwd);
  const { formatters } = await loadPlugins(config.plugins);

  const lines: string[] = [];

  // 标题
  lines.push(`# PR #${prNumber} 变更日志`);
  lines.push('');

  // 变更包列表
  lines.push('## 变更包列表：');
  lines.push('');
  if (changedPackages.length === 0) {
    lines.push('（无变更包）');
  } else {
    for (const pkg of changedPackages) {
      lines.push(`- ${pkg}`);
    }
  }

  // 根据解析结果生成章节
  lines.push('');

  // 构建包名 -> 变更日志的映射
  const packageLogMap = new Map<string, string>();

  for (const { packages, changeLog } of packageChangeLogs) {
    if (packages.length === 0) {
      // 格式 C：无包名声明，应用到所有变更包
      for (const pkg of changedPackages) {
        packageLogMap.set(pkg, changeLog);
      }
    } else {
      // 格式 A/B：应用到指定的包
      for (const pkg of packages) {
        packageLogMap.set(pkg, changeLog);
      }
    }
  }

  // 为每个变更的包生成独立章节
  for (const pkg of changedPackages) {
    lines.push('---');
    lines.push('');
    lines.push(`## ${pkg}`);
    lines.push('');
    lines.push('### 标题');
    lines.push('');
    lines.push(title);
    lines.push('');
    lines.push('### 变更日志');
    lines.push('');
    
    const changeLog = packageLogMap.get(pkg) || '（无对应的变更日志）';
    // 应用格式化器
    const formattedLog = applyFormatters(parseChangelog(changeLog), formatters);
    lines.push(formattedLog);
    lines.push('');
  }

  return lines.join('\n');
}

/** 检测哪些包发生了变化（基于 git diff package.json）*/
async function detectChangedPackages(
  baseRef: string,
  headRef: string,
  cwd?: string,
): Promise<string[]> {
  try {
    const files = await diffFiles(baseRef, headRef, cwd);
    const packages = new Set<string>();
    for (const file of files) {
      // 匹配 packages/*/package.json
      const match = file.match(/^packages\/([^/]+)\/package\.json$/);
      if (match) {
        packages.add(match[1]);
      }
    }

    return Array.from(packages);
  } catch (err) {
    console.error('[collect] 检测变更包失败:', err);
    return [];
  }
}

async function saveSnapshot(
  prNumber: number,
  title: string,
  releaseLog: string | null,
  formattedMarkdown: string,
  cwd?: string,
): Promise<string> {
  const base = cwd || process.cwd();

  // 1. 保存 JSON 元数据（向后兼容）
  const jsonDir = resolve(base, '.release-toolkit', 'changelog', 'prs');
  mkdirSync(jsonDir, { recursive: true });
  const jsonPath = resolve(jsonDir, `pr-${prNumber}.json`);
  writeFileSync(
    jsonPath,
    JSON.stringify({ prNumber, title, releaseLog, savedAt: new Date().toISOString() }, null, 2),
  );

  // 2. 保存 Markdown 快照到 releases/ 目录
  const releasesDir = resolve(base, '.release-toolkit', 'releases');
  mkdirSync(releasesDir, { recursive: true });
  const now = new Date();
  const timestamp = [
    String(now.getFullYear()).slice(-2),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    '-',
    String(now.getHours()).padStart(2, '0'),
    '-',
    String(now.getMinutes()).padStart(2, '0'),
    '-',
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
  const mdPath = resolve(releasesDir, `pr${prNumber}-${timestamp}.md`);
  writeFileSync(mdPath, formattedMarkdown);

  return mdPath;
}

function updatePRBody(currentBody: string | null, newContent: string): string {
  const body = currentBody ?? '';
  const explanation = generateSpecExplanation();
  const wrappedContent = `${OUTPUT_START}\n${explanation}\n${newContent}\n${OUTPUT_END}`;

  if (body.includes(OUTPUT_START) && body.includes(OUTPUT_END)) {
    // 幂等更新：替换现有标记区内容
    return body.replace(
      new RegExp(`${escapeRegex(OUTPUT_START)}[\\s\\S]*?${escapeRegex(OUTPUT_END)}`, 'g'),
      wrappedContent,
    );
  }

  // 首次运行：追加到描述体末尾
  return `${body}\n\n${wrappedContent}`;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
