/**
 * Release Toolkit - GitHub App Server (Cloudflare Worker)
 *
 * 职责：
 * 1. 验证 GitHub Webhook 签名（按需）
 * 2. 监听 pull_request / pull_request_review 事件
 * 3. 与 `@release-toolkit/core` 的 CLI 输出保持一致的评论格式
 * 4. 通过 workflow_dispatch 触发 CI 完成实际发布
 *
 * 事件 → 行为：
 * - pull_request.opened/reopened/synchronize/edited（base = RELEASE_BASE_BRANCH）
 *     → upsert PR 评论：通知 + 版本 diff + 预览 + 修改指南
 * - pull_request_review.submitted (state=approved)
 *     → 把当前评论中的预览写入 PR 描述体（RELEASE-TOOLKIT-OUTPUT 标记区，幂等）
 * - pull_request.closed (merged && base = RELEASE_BASE_BRANCH)
 *     → 触发 release-publish workflow（由 CI 执行 @release-toolkit/core publishRelease）
 */

import { App, Octokit, type Octokit as OctokitType } from 'octokit';

// ============================================================================
// 环境与常量
// ============================================================================

interface Env {
  GITHUB_APP_ID?: string;
  GITHUB_APP_PRIVATE_KEY?: string;
  GITHUB_WEBHOOK_SECRET?: string;
  /** 触发收集 / 发布的目标分支（默认 dev） */
  RELEASE_BASE_BRANCH?: string;
  /** 合并后触发的 workflow 文件名（默认 release-publish.yml） */
  RELEASE_PUBLISH_WORKFLOW?: string;
  /**
   * 控制评论输出区块：JSON 字符串
   * 例：`{"notification":true,"preview":true,"editGuide":false}`
   */
  OUTPUT_SECTIONS?: string;
}

interface OutputSections {
  notification: boolean;
  preview: boolean;
  editGuide: boolean;
}

const DEFAULT_OUTPUT_SECTIONS: OutputSections = {
  notification: true,
  preview: true,
  editGuide: true,
};

function resolveOutputSections(env: Env): OutputSections {
  if (!env.OUTPUT_SECTIONS) return { ...DEFAULT_OUTPUT_SECTIONS };
  try {
    const parsed = JSON.parse(env.OUTPUT_SECTIONS) as Partial<OutputSections>;
    return {
      notification: parsed.notification ?? DEFAULT_OUTPUT_SECTIONS.notification,
      preview: parsed.preview ?? DEFAULT_OUTPUT_SECTIONS.preview,
      editGuide: parsed.editGuide ?? DEFAULT_OUTPUT_SECTIONS.editGuide,
    };
  } catch (err) {
    console.warn('[outputSections] 无法解析 OUTPUT_SECTIONS，使用默认值:', err);
    return { ...DEFAULT_OUTPUT_SECTIONS };
  }
}

const DEFAULT_BASE_BRANCH = 'dev';
const DEFAULT_PUBLISH_WORKFLOW = 'release-publish.yml';

const RELEASE_LOG_START = '<!-- RELEASE-LOG-START -->';
const RELEASE_LOG_END = '<!-- RELEASE-LOG-END -->';
const OUTPUT_START = '<!-- RELEASE-TOOLKIT-OUTPUT-START -->';
const OUTPUT_END = '<!-- RELEASE-TOOLKIT-OUTPUT-END -->';
const COMMENT_ANCHOR_START = '<!-- release-toolkit-comment-start -->';
const COMMENT_ANCHOR_END = '<!-- release-toolkit-comment-end -->';

const COMMIT_TYPE_EMOJI: Record<string, string> = {
  feat: '✨',
  fix: '🐛',
  docs: '📝',
  style: '💄',
  refactor: '♻️',
  perf: '⚡️',
  test: '✅',
  build: '📦️',
  ci: '👷',
  chore: '🔧',
  revert: '⏪️',
};

// ============================================================================
// 类型定义
// ============================================================================

interface PullRequestPayload {
  action?: string;
  pull_request?: {
    number: number;
    title: string;
    body?: string | null;
    merged?: boolean;
    base?: {
      ref?: string;
      repo?: {
        owner?: { login?: string };
        name?: string;
      };
    };
    head?: {
      ref?: string;
      sha?: string;
    };
  };
  review?: {
    state?: string;
  };
  installation?: {
    id?: number;
  };
}

interface PackageChangeLog {
  packages: string[];
  changeLog: string;
}

interface VersionDiff {
  packageName: string;
  currentVersion: string;
  newVersion: string;
}

interface PRContext {
  owner: string;
  repo: string;
  prNumber: number;
  prTitle: string;
  prBody: string | null;
  baseRef: string;
  headRef: string;
  headSha: string;
}

// ============================================================================
// 工具函数（纯字符串处理，与 core 行为对齐）
// ============================================================================

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyEmojiPrefix(line: string): string {
  const match = line.match(/^-?\s*(\w+)(?:\([^)]+\))?:/);
  if (match) {
    const emoji = COMMIT_TYPE_EMOJI[match[1]];
    if (emoji && !line.includes(emoji)) {
      return line.replace(match[0], `${emoji} ${match[0]}`);
    }
  }
  return line;
}

/** 将一段文本拆成 bullet 列表，已以 `-` 开头的行不重复添加前缀 */
function toBulletLines(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    lines.push(trimmed.startsWith('-') ? trimmed : `- ${trimmed}`);
  }
  return lines;
}

function formatTitleBullet(title: string): string {
  return applyEmojiPrefix(`- ${title}（标题）`);
}

function formatChangeLogBullets(changeLog: string): string[] {
  const trimmed = changeLog.trim();
  if (!trimmed) {
    return ['- （无对应的变更日志）'];
  }
  return toBulletLines(trimmed).map(applyEmojiPrefix);
}

/**
 * 解析 RELEASE-LOG 标记区，识别 `## pkg-a, pkg-b` 分组
 *
 * 支持两种用户写法：
 * - `## pkg`（紧跟一个或多个普通行 / `### 子标题` 的列表）
 * - 无 `##` 的纯列表（作为"通用变更"）
 */
function parseReleaseLog(content: string): PackageChangeLog[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const lines = trimmed.split('\n');
  const result: PackageChangeLog[] = [];
  let currentPackages: string[] = [];
  let currentLines: string[] = [];
  let started = false;

  const flush = () => {
    const log = currentLines.join('\n').trim();
    if (!log) return;
    result.push({ packages: [...currentPackages], changeLog: log });
  };

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('## ') && !t.startsWith('### ')) {
      if (started) flush();
      currentPackages = t
        .replace(/^## /, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      currentLines = [];
      started = true;
      continue;
    }
    if (t.startsWith('### ')) {
      // 兼容旧格式：跳过 `### 标题` / `### 变更日志` 这类副标题
      continue;
    }
    if (started) {
      currentLines.push(line);
    } else {
      // 处于第一个 `##` 之前的内容 → 视为通用变更
      currentLines.push(line);
    }
  }
  if (started) {
    flush();
  } else if (currentLines.join('\n').trim()) {
    result.push({ packages: [], changeLog: currentLines.join('\n').trim() });
  }
  return result;
}

interface ExtractedReleaseLog {
  rawReleaseLog: string | null;
  packageChangeLogs: PackageChangeLog[];
}

function extractReleaseLog(body: string | null): ExtractedReleaseLog {
  if (!body) return { rawReleaseLog: null, packageChangeLogs: [] };
  const startIdx = body.indexOf(RELEASE_LOG_START);
  const endIdx = body.indexOf(RELEASE_LOG_END);
  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
    return { rawReleaseLog: null, packageChangeLogs: [] };
  }
  const raw = body.substring(startIdx + RELEASE_LOG_START.length, endIdx).trim();
  return {
    rawReleaseLog: raw || null,
    packageChangeLogs: parseReleaseLog(raw),
  };
}

// ============================================================================
// GitHub API 包装
// ============================================================================

async function getPR(octokit: OctokitType, ctx: { owner: string; repo: string; prNumber: number }) {
  const { data } = await octokit.rest.pulls.get({
    owner: ctx.owner,
    repo: ctx.repo,
    pull_number: ctx.prNumber,
  });
  return data;
}

async function listChangedPackages(
  octokit: OctokitType,
  ctx: { owner: string; repo: string; prNumber: number },
): Promise<string[]> {
  const pkgs = new Set<string>();
  // 单次请求最多 100 个文件；按页迭代
  for await (const { data } of octokit.paginate.iterator(octokit.rest.pulls.listFiles, {
    owner: ctx.owner,
    repo: ctx.repo,
    pull_number: ctx.prNumber,
    per_page: 100,
  })) {
    for (const f of data) {
      const m = f.filename.match(/^packages\/([^/]+)\/package\.json$/);
      if (m) pkgs.add(m[1]);
    }
  }
  return Array.from(pkgs);
}

async function getPackageJsonAtRef(
  octokit: OctokitType,
  owner: string,
  repo: string,
  pkgDir: string,
  ref: string,
): Promise<{ name?: string; version?: string } | null> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: `packages/${pkgDir}/package.json`,
      ref,
    });
    if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) return null;
    const decoded = atob(data.content.replace(/\n/g, ''));
    const parsed = JSON.parse(decoded) as { name?: string; version?: string };
    return parsed;
  } catch {
    return null;
  }
}

async function collectVersionDiffs(
  octokit: OctokitType,
  owner: string,
  repo: string,
  changedPkgs: string[],
  baseRef: string,
  headSha: string,
): Promise<VersionDiff[]> {
  const diffs: VersionDiff[] = [];
  for (const dir of changedPkgs) {
    const [basePkg, headPkg] = await Promise.all([
      getPackageJsonAtRef(octokit, owner, repo, dir, baseRef),
      getPackageJsonAtRef(octokit, owner, repo, dir, headSha),
    ]);
    if (!headPkg?.version) continue;
    const current = basePkg?.version ?? '—';
    const next = headPkg.version;
    if (current === next) continue;
    diffs.push({
      packageName: headPkg.name ?? dir,
      currentVersion: current,
      newVersion: next,
    });
  }
  return diffs;
}

async function findToolComment(
  octokit: OctokitType,
  ctx: { owner: string; repo: string; prNumber: number },
): Promise<number | null> {
  for await (const { data } of octokit.paginate.iterator(octokit.rest.issues.listComments, {
    owner: ctx.owner,
    repo: ctx.repo,
    issue_number: ctx.prNumber,
    per_page: 100,
  })) {
    for (const c of data) {
      if (c.body?.includes(COMMENT_ANCHOR_START)) return c.id;
    }
  }
  return null;
}

async function upsertPRComment(
  octokit: OctokitType,
  ctx: { owner: string; repo: string; prNumber: number },
  body: string,
): Promise<void> {
  const wrapped = `${COMMENT_ANCHOR_START}\n${body}\n${COMMENT_ANCHOR_END}`;
  const existingId = await findToolComment(octokit, ctx);
  if (existingId) {
    await octokit.rest.issues.updateComment({
      owner: ctx.owner,
      repo: ctx.repo,
      comment_id: existingId,
      body: wrapped,
    });
  } else {
    await octokit.rest.issues.createComment({
      owner: ctx.owner,
      repo: ctx.repo,
      issue_number: ctx.prNumber,
      body: wrapped,
    });
  }
}

async function updatePRBody(
  octokit: OctokitType,
  ctx: { owner: string; repo: string; prNumber: number },
  newBody: string,
): Promise<void> {
  await octokit.rest.pulls.update({
    owner: ctx.owner,
    repo: ctx.repo,
    pull_number: ctx.prNumber,
    body: newBody,
  });
}

async function dispatchWorkflow(
  octokit: OctokitType,
  ctx: { owner: string; repo: string },
  workflowFile: string,
  ref: string,
  inputs: Record<string, string>,
): Promise<boolean> {
  try {
    await octokit.rest.actions.createWorkflowDispatch({
      owner: ctx.owner,
      repo: ctx.repo,
      workflow_id: workflowFile,
      ref,
      inputs,
    });
    return true;
  } catch (err) {
    console.error('[dispatchWorkflow] failed:', err);
    return false;
  }
}

// ============================================================================
// 评论 / 描述体内容构建
// ============================================================================

function renderVersionDiffTable(diffs: VersionDiff[]): string {
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
  const heading = packageDisplayName === packageDir
    ? `## ${packageDir}`
    : `## ${packageDisplayName}`;
  lines.push(heading);
  lines.push('');
  lines.push(formatTitleBullet(prTitle));
  for (const b of formatChangeLogBullets(changeLog)) {
    lines.push(b);
  }
  return lines.join('\n');
}

function buildPreviewMarkdown(
  prCtx: PRContext,
  changedPackages: string[],
  versionDiffs: VersionDiff[],
  parsedLogs: PackageChangeLog[],
): string {
  const lines: string[] = [];

  // 标题
  lines.push(`# PR #${prCtx.prNumber} 变更日志`);
  lines.push('');

  // 变更包列表
  lines.push('## 变更包列表：');
  lines.push('');
  if (changedPackages.length === 0) {
    lines.push('（无变更包）');
  } else {
    for (const pkg of changedPackages) {
      const diff = versionDiffs.find((d) => d.packageName === pkg || d.packageName.endsWith(`/${pkg}`));
      lines.push(
        diff
          ? `- \`${diff.packageName}\`：${diff.currentVersion} → ${diff.newVersion}`
          : `- \`${pkg}\``,
      );
    }
  }
  lines.push('');

  // 计算 pkg → log 映射
  const logMap = new Map<string, string>();
  for (const { packages, changeLog } of parsedLogs) {
    if (packages.length === 0) {
      for (const pkg of changedPackages) logMap.set(pkg, changeLog);
    } else {
      for (const pkg of packages) logMap.set(pkg, changeLog);
    }
  }

  // 每个包的章节
  const targets = changedPackages.length > 0 ? changedPackages : ['__default__'];
  for (const pkg of targets) {
    const displayName =
      pkg === '__default__'
        ? '变更内容'
        : versionDiffs.find((d) => d.packageName === pkg || d.packageName.endsWith(`/${pkg}`))?.packageName ?? pkg;
    lines.push(renderPackageSection(pkg, displayName, prCtx.prTitle, logMap.get(pkg) ?? ''));
    lines.push('');
  }

  return lines.join('\n').trim();
}

function buildEditGuide(): string {
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

function buildPRComment(input: {
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
    const status = approved ? '✅ **PR 已批准** —— 日志将写入 PR 描述体' : '📢 **PR 待审批**';
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

function buildConfirmedReleaseLog(
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

function wrapOutputMarkers(content: string): string {
  return `${OUTPUT_START}\n${content}\n${OUTPUT_END}`;
}

function upsertOutputInBody(currentBody: string | null, content: string): string {
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

// ============================================================================
// 业务流程
// ============================================================================

async function buildPRContext(
  octokit: OctokitType,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PRContext> {
  const pr = await getPR(octokit, { owner, repo, prNumber });
  return {
    owner,
    repo,
    prNumber,
    prTitle: pr.title ?? '',
    prBody: pr.body ?? null,
    baseRef: pr.base?.ref ?? '',
    headRef: pr.head?.ref ?? '',
    headSha: pr.head?.sha ?? '',
  };
}

async function runCollect(
  octokit: OctokitType,
  prCtx: PRContext,
  sections: OutputSections,
  approved = false,
): Promise<{ ok: boolean; commentBody?: string; error?: string }> {
  try {
    const changedPackages = await listChangedPackages(octokit, prCtx);
    const versionDiffs = await collectVersionDiffs(
      octokit,
      prCtx.owner,
      prCtx.repo,
      changedPackages,
      prCtx.baseRef,
      prCtx.headSha,
    );
    const { packageChangeLogs } = extractReleaseLog(prCtx.prBody);
    const commentBody = buildPRComment({
      prCtx,
      changedPackages,
      versionDiffs,
      parsedLogs: packageChangeLogs,
      sections,
      approved,
    });
    await upsertPRComment(octokit, prCtx, commentBody);
    return { ok: true, commentBody };
  } catch (err) {
    console.error('[runCollect] failed:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runConfirmAndWriteToBody(
  octokit: OctokitType,
  prCtx: PRContext,
  sections: OutputSections,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const changedPackages = await listChangedPackages(octokit, prCtx);
    const versionDiffs = await collectVersionDiffs(
      octokit,
      prCtx.owner,
      prCtx.repo,
      changedPackages,
      prCtx.baseRef,
      prCtx.headSha,
    );
    const { packageChangeLogs } = extractReleaseLog(prCtx.prBody);
    const confirmedLog = buildConfirmedReleaseLog(prCtx, changedPackages, versionDiffs, packageChangeLogs);
    const newBody = upsertOutputInBody(prCtx.prBody, confirmedLog);
    if (newBody === prCtx.prBody) return { ok: true };
    await updatePRBody(octokit, prCtx, newBody);
    // 同时把通知评论刷新为「已批准」
    await runCollect(octokit, { ...prCtx, prBody: newBody }, sections, true);
    return { ok: true };
  } catch (err) {
    console.error('[runConfirmAndWriteToBody] failed:', err);
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

async function runTriggerRelease(
  octokit: OctokitType,
  prCtx: PRContext,
  workflowFile: string,
): Promise<{ ok: boolean; error?: string }> {
  const dispatched = await dispatchWorkflow(
    octokit,
    { owner: prCtx.owner, repo: prCtx.repo },
    workflowFile,
    prCtx.baseRef,
    {
      pr_number: String(prCtx.prNumber),
      pr_title: prCtx.prTitle,
    },
  );
  return dispatched
    ? { ok: true }
    : { ok: false, error: `Failed to dispatch ${workflowFile}` };
}

// ============================================================================
// 事件分发
// ============================================================================

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function expectedBaseBranch(env: Env): string {
  return env.RELEASE_BASE_BRANCH || DEFAULT_BASE_BRANCH;
}

async function handlePullRequest(
  payload: PullRequestPayload,
  octokit: OctokitType,
  env: Env,
): Promise<Response> {
  const action = payload.action;
  const pr = payload.pull_request;
  if (!pr) return jsonResponse({ success: true, status: 'no pull_request payload' });

  const baseRef = pr.base?.ref ?? '';
  const expected = expectedBaseBranch(env);
  if (baseRef !== expected) {
    return jsonResponse({
      success: true,
      status: 'skipped',
      reason: `base ${baseRef} ≠ ${expected}`,
    });
  }

  const owner = pr.base?.repo?.owner?.login ?? '';
  const repo = pr.base?.repo?.name ?? '';
  if (!owner || !repo) {
    return jsonResponse({ success: false, error: 'missing repo in payload' }, 400);
  }

  const prCtx = await buildPRContext(octokit, owner, repo, pr.number);

  // 合并 + base 命中 → 触发发布 workflow
  if (action === 'closed' && pr.merged) {
    const workflowFile = env.RELEASE_PUBLISH_WORKFLOW || DEFAULT_PUBLISH_WORKFLOW;
    const result = await runTriggerRelease(octokit, prCtx, workflowFile);
    return jsonResponse({
      success: result.ok,
      action: 'releasePublisher',
      workflow: workflowFile,
      error: result.error,
    });
  }

  // 关闭但未合并 → 不处理
  if (action === 'closed') {
    return jsonResponse({ success: true, action: 'closed-unmerged', status: 'ignored' });
  }

  // 创建 / 同步 → upsert 评论
  if (
    action === 'opened' ||
    action === 'reopened' ||
    action === 'synchronize' ||
    action === 'edited' ||
    action === 'ready_for_review'
  ) {
    const sections = resolveOutputSections(env);
    const result = await runCollect(octokit, prCtx, sections);
    return jsonResponse({ success: result.ok, action: 'prLogCollector', error: result.error });
  }

  return jsonResponse({ success: true, action: action ?? 'unknown', status: 'ignored' });
}

async function handlePullRequestReview(
  payload: PullRequestPayload,
  octokit: OctokitType,
  env: Env,
): Promise<Response> {
  const pr = payload.pull_request;
  const review = payload.review;
  if (!pr || !review) return jsonResponse({ success: true, status: 'no review payload' });
  if (payload.action !== 'submitted' || review.state !== 'approved') {
    return jsonResponse({ success: true, action: payload.action ?? '', status: 'ignored' });
  }

  const baseRef = pr.base?.ref ?? '';
  const expected = expectedBaseBranch(env);
  if (baseRef !== expected) {
    return jsonResponse({ success: true, status: 'skipped', reason: `base ${baseRef} ≠ ${expected}` });
  }

  const owner = pr.base?.repo?.owner?.login ?? '';
  const repo = pr.base?.repo?.name ?? '';
  if (!owner || !repo) {
    return jsonResponse({ success: false, error: 'missing repo in payload' }, 400);
  }
  const prCtx = await buildPRContext(octokit, owner, repo, pr.number);
  const sections = resolveOutputSections(env);
  const result = await runConfirmAndWriteToBody(octokit, prCtx, sections);
  return jsonResponse({ success: result.ok, action: 'logWrite', error: result.error });
}

// ============================================================================
// 入口
// ============================================================================

async function verifySignature(
  secret: string,
  signature: string,
  body: string,
): Promise<boolean> {
  if (!signature.startsWith('sha256=')) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const sigBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hex = Array.from(new Uint8Array(sigBytes))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return `sha256=${hex}` === signature;
  } catch (err) {
    console.error('[verifySignature] failed:', err);
    return false;
  }
}

async function acquireOctokit(
  env: Env,
  payload: { installation?: { id?: number } },
): Promise<OctokitType | null> {
  if (env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY && payload.installation?.id) {
    try {
      const app = new App({
        appId: Number(env.GITHUB_APP_ID),
        privateKey: env.GITHUB_APP_PRIVATE_KEY,
      });
      return await app.getInstallationOctokit(payload.installation.id);
    } catch (err) {
      console.error('[acquireOctokit] failed:', err);
      return null;
    }
  }
  return new Octokit();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405);
    }

    const body = await request.text();
    const eventType = request.headers.get('X-GitHub-Event') ?? '';
    const signature = request.headers.get('X-Hub-Signature-256') ?? '';
    const deliveryId = request.headers.get('X-GitHub-Delivery') ?? '';
    console.log(`[webhook] ${eventType} delivery=${deliveryId}`);

    if (env.GITHUB_WEBHOOK_SECRET) {
      const ok = await verifySignature(env.GITHUB_WEBHOOK_SECRET, signature, body);
      if (!ok) return jsonResponse({ success: false, error: 'Invalid signature' }, 401);
    }

    let payload: PullRequestPayload;
    try {
      payload = JSON.parse(body) as PullRequestPayload;
    } catch {
      return jsonResponse({ success: false, error: 'Invalid JSON' }, 400);
    }

    const octokit = await acquireOctokit(env, payload);
    if (!octokit) {
      return jsonResponse({ success: false, error: 'Unable to authenticate' }, 401);
    }

    try {
      switch (eventType) {
        case 'pull_request':
          return await handlePullRequest(payload, octokit, env);
        case 'pull_request_review':
          return await handlePullRequestReview(payload, octokit, env);
        case 'ping':
          return jsonResponse({ success: true, status: 'pong' });
        default:
          return jsonResponse({ success: true, event: eventType, status: 'ignored' });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[webhook] handler error:', msg);
      return jsonResponse({ success: false, error: msg }, 500);
    }
  },
};
