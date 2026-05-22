import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { diffFiles } from '../../shared/git/git-reader.js';
import { loadConfig } from '../../shared/config/index.js';
import type { GithubContext, ReleaseHookContext, PRLogCollectorResult } from '../../shared/types.js';
import { getPR, updatePR } from '../../shared/github/api-client.js';
import { extractReleaseLog, type PackageChangeLog } from './release-log-extractor.js';
import type { PRLogCollectorOptions, PRMeta } from './types.js';
import { loadPlugins, loadPluginsAsIPlugin } from '../../shared/plugins/index.js';
import { HookRunner } from '../../shared/hook-runner.js';
import { IS_WORKER, OUTPUT_MARKERS, escapeRegex } from '../../shared/utils.js';
import { formatTitleBullet, formatChangeLogBullets } from './package-log-format.js';

const { OUTPUT_START, OUTPUT_END } = OUTPUT_MARKERS;

/** 生成标记区的用户指南（使用引用格式，用户可见） */
function generateSpecExplanation(): string {
  const lines: string[] = [
    '> 📖 **RELEASE-TOOLKIT 输出说明**',
    '>',
    '> - 部分包共享日志，部分包独立：',
    '> ```',
    '> ## package-a, package-b',
    '> - feat: xxx（标题）',
    '> - 共同的变更内容',
    '>',
    '> ## package-c',
    '> - feat: xxx（标题）',
    '> - package-c 的独立变更',
    '> ```',
    '>',
    '> - 无包名声明（基于 `git diff packages/*/package.json`）：',
    '> ```',
    '> - feat: xxx（标题）',
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

async function fetchPRMeta(context: GithubContext): Promise<PRMeta> {
  const { data } = await getPR(context);

  // getPR 返回 Record<string, unknown>，此处做单次类型断言
  // 对应 GitHub REST API /pulls/{pull_number} 响应的已知字段
  const prData = data as unknown as GitHubPRResponse;

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

  const hookContext: ReleaseHookContext = {
    packageName: '',
    oldVersion: '',
    newVersion: '',
    tagName: '',
  };

  try {
    const config = loadConfig(options.cwd);
    const hookRunner = new HookRunner([]);

    // 1. 加载插件
    const { plugins: iPlugins } = await loadPluginsAsIPlugin(config.plugins);
    hookRunner.setPlugins(iPlugins);

    // 2. 执行 beforeCollect 钩子
    await hookRunner.runBeforeCollect(hookContext);

    // 3. 执行核心逻辑
    const meta = await fetchPRMeta(context);
    const { packageChangeLogs, rawReleaseLog } = extractReleaseLog(
      meta.body,
      config,
    );

    const { formatters } = await loadPlugins();
    const markdown = await generateStructuredMarkdown(
      meta.number,
      meta.title,
      packageChangeLogs,
      meta.baseRef,
      meta.headRef,
      options.cwd,
      formatters,
      IS_WORKER,
    );

    // 更新 PR 描述体（幂等）
    const updatedBody = updatePRBody(meta.body, markdown);
    await updatePR(context, updatedBody);

    // 保存快照到 .release-toolkit/releases/（Worker 环境跳过）
    let savedPath: string | undefined;
    if (options.save && !isWorker && rawReleaseLog) {
      savedPath = await saveSnapshot(meta.number, meta.title, rawReleaseLog, markdown, options.cwd);
    }

    const result: PRLogCollectorResult = {
      success: true,
      prNumber: meta.number,
      prTitle: meta.title,
      changelog: rawReleaseLog || '',
      commentPosted: true,
      savedPath,
    };

    // 4. 执行 afterCollect 钩子
    await hookRunner.runAfterCollect(hookContext, result);

    return result;
  } catch (err) {
    return {
      success: false,
      prNumber: options.prNumber,
      prTitle: '',
      changelog: '',
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
  _formatters: Awaited<ReturnType<typeof loadPlugins>>['formatters'] = [],
  skipGitOps = false,
): Promise<string> {
  const base = cwd || process.cwd();
  const changedPackages = skipGitOps ? [] : await detectChangedPackages(baseRef, headRef, base);
  const { formatters: loadedFormatters } = await loadPlugins();

  const lines: string[] = [];

  // 标题
  lines.push(`# PR #${prNumber} 变更日志`);
  lines.push('');

  // 变更包列表（Worker 环境显示提示）
  lines.push('## 变更包列表：');
  lines.push('');
  if (skipGitOps) {
    lines.push('（Worker 环境：请在 CI 中执行完整收集）');
  } else if (changedPackages.length === 0) {
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
      if (skipGitOps) {
        packageLogMap.set('__default__', changeLog);
      } else {
        for (const pkg of changedPackages) {
          packageLogMap.set(pkg, changeLog);
        }
      }
    } else {
      // 格式 A/B：应用到指定的包
      for (const pkg of packages) {
        packageLogMap.set(pkg, changeLog);
      }
    }
  }

  // 为每个变更的包生成独立章节（或 Worker 环境下生成默认章节）
  const packagesToProcess = skipGitOps ? ['__default__'] : changedPackages;
  for (const pkg of packagesToProcess) {
    lines.push(`## ${pkg === '__default__' ? '变更内容' : pkg}`);
    lines.push('');
    lines.push(formatTitleBullet(title, loadedFormatters));

    const changeLog = packageLogMap.get(pkg) ?? '';
    for (const bullet of formatChangeLogBullets(changeLog, loadedFormatters)) {
      lines.push(bullet);
    }
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
