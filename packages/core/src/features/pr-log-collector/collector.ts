import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { loadConfig, type ReleaseToolkitConfig } from '../../shared/config/index.js';
import type { GithubContext } from '../../shared/types.js';
import { getPR, updatePR } from '../../shared/github/api-client.js';
import { postOrUpdateComment } from '../../shared/github/pr-commenter.js';
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
    await updatePR(context, updatedBody);

    // 可选：同时更新评论区（用于通知）
    await postOrUpdateComment(context, commentBody, {
      markerStart: OUTPUT_START,
      markerEnd: OUTPUT_END,
    });

    let savedPath: string | undefined;
    if (options.save) {
      savedPath = await saveSnapshot(meta.number, meta.title, releaseLog, options.cwd);
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
  cwd?: string,
): Promise<string> {
  const base = cwd || process.cwd();
  const snapshotDir = resolve(base, '.release-toolkit', 'changelog', 'prs');
  mkdirSync(snapshotDir, { recursive: true });

  const snapshotPath = resolve(snapshotDir, `pr-${prNumber}.json`);
  writeFileSync(
    snapshotPath,
    JSON.stringify({ prNumber, title, releaseLog, savedAt: new Date().toISOString() }, null, 2),
  );

  return snapshotPath;
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
