import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadConfig, type ReleaseToolkitConfig } from '../../shared/config/index.js';
import type { GithubContext } from '../../shared/types.js';
import { getPR, updatePR } from '../../shared/github/api-client.js';
import { extractReleaseLog } from './release-log-extractor.js';
import { formatPRLogComment } from './formatter.js';
import type { PRLogCollectorOptions, PRLogCollectorResult, PRMeta } from './types.js';

const OUTPUT_START = '<!-- RELEASE-TOOLKIT-OUTPUT-START -->';
const OUTPUT_END = '<!-- RELEASE-TOOLKIT-OUTPUT-END -->';

async function fetchPRMeta(context: GithubContext, _config: ReleaseToolkitConfig): Promise<PRMeta> {
  const { data } = await getPR(context);
  return {
    number: data.number as number,
    title: data.title as string,
    body: (data.body as string | null) ?? null,
    baseRef: data.base_ref as string,
    headRef: data.head_ref as string,
  };
}

export async function collectPRLog(
  options: PRLogCollectorOptions,
): Promise<PRLogCollectorResult> {
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
    const { releaseLog } = extractReleaseLog(meta.body, config);

    const commentBody = formatPRLogComment(meta.title, releaseLog);

    // 更新 PR 描述体（幂等）
    const updatedBody = updatePRBody(meta.body, commentBody);
    console.log('[collect] 准备更新 PR 描述体，长度:', updatedBody.length);
    try {
      await updatePR(context, updatedBody);
      console.log('[collect] ✅ PR 描述体更新成功');
    } catch (updateErr) {
      console.error('[collect] ❌ PR 描述体更新失败:', updateErr);
      throw updateErr; // 重新抛出，让外层 catch 处理
    }

    let savedPath: string | undefined;
    if (options.save) {
      savedPath = await saveSnapshot(meta.number, meta.title, releaseLog, commentBody, options.cwd);
    }

    return {
      success: true,
      prNumber: meta.number,
      title: meta.title,
      releaseLog,
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

async function saveSnapshot(
  prNumber: number,
  title: string,
  releaseLog: string | null,
  formattedComment: string,
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
  const mdContent = [
    `# PR #${prNumber} 变更日志`,
    ``,
    `> 生成时间：${new Date().toISOString()}`,
    ``,
    `## PR 标题`,
    ``,
    title,
    ``,
    `## 详细说明`,
    ``,
    releaseLog || '（无 RELEASE-LOG 标记区内容）',
    ``,
  ].join('\n');
  writeFileSync(mdPath, mdContent);

  return mdPath;
}

function updatePRBody(currentBody: string | null, newContent: string): string {
  const body = currentBody ?? '';
  const wrappedContent = `${OUTPUT_START}\n${newContent}\n${OUTPUT_END}`;

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
