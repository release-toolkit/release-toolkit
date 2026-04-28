import { Command } from 'commander';
import {
  GithubContextDetector,
  PRCommentPoster,
  ChangelogRenderer,
  PluginManager,
  Pipeline,
  loadConfig,
  consumeAllSnapshots,
  collectEntriesFromSnapshots,
  type ConsumedSnapshot,
} from '@release-toolkit/core';

interface PreviewResult {
  success: boolean;
  changed: boolean;
  markdown: string;
  dryRun: boolean;
}

/**
 * Stage 2: PR → base branch
 *
 *   Consume all saved PR changelog snapshots from .releasetoolkit/changelog/prs/
 *   and post a preview comment on the current PR.
 *
 * Does NOT write files, create tags, or create releases.
 * Intended for use when a PR targets the base branch (e.g. main).
 */
async function runPreview(cwd: string, dryRun: boolean): Promise<PreviewResult> {
  const config = loadConfig(cwd, { dryRun });

  console.log('=== Release Preview (Stage 2) ===');
  console.log(`[Preview] Base ref: ${config.baseRef}`);
  console.log(`[Preview] Dry run: ${config.dryRun}`);

  // ── Step 0: Detect GitHub environment ────────
  console.log('\n[Preview] Step 0: Detecting environment...');
  const contextDetector = new GithubContextDetector();
  const githubCtx = contextDetector.detect();

  if (!githubCtx.isGitHubActions || !githubCtx.prNumber) {
    console.warn('[Preview] Not in a PR context. Set GITHUB_EVENT_NAME and GITHUB_PR_NUMBER, or run in GitHub Actions.');
    return { success: false, changed: false, markdown: '', dryRun };
  }

  console.log(`[Preview] PR #${githubCtx.prNumber} on ${githubCtx.repoOwner}/${githubCtx.repoName}`);

  // ── Step 1: Consume all PR snapshots ─────────
  console.log('\n[Preview] Step 1: Consuming PR changelog snapshots...');
  const snapshots = consumeAllSnapshots(cwd);

  if (snapshots.length === 0) {
    console.log('[Preview] No PR changelog snapshots found.');
  } else {
    console.log(`[Preview] Loaded ${snapshots.length} PR snapshot(s)`);
  }

  // ── Step 2: Build Release Changelog via Pipeline ──
  console.log('\n[Preview] Step 2: Building Release Changelog...');

  // 2a. Collect structured entries
  const rawEntries = collectEntriesFromSnapshots(snapshots);

  // 2b. Load plugins and run Pipeline
  const pluginManager = new PluginManager(cwd);
  for (const name of config.plugins) {
    await pluginManager.loadByName(name);
  }
  console.log(`[Preview] Loaded plugins: [${pluginManager.getRegisteredNames().join(', ')}]`);

  const pipeline = new Pipeline(pluginManager);
  const output = await pipeline.run(rawEntries, 'preview');

  // 2c. Render to Markdown
  const repoUrl = githubCtx.repoOwner && githubCtx.repoName
    ? `https://github.com/${githubCtx.repoOwner}/${githubCtx.repoName}`
    : undefined;
  const renderer = new ChangelogRenderer({ repoUrl });
  const markdown = renderer.renderMarkdown(output);

  console.log(
    `\n[Preview] Generated changelog:\n${'='.repeat(50)}\n${markdown}\n${'='.repeat(50)}`,
  );

  // ── Step 3: Post/Update PR comment (preview) ─
  if (config.dryRun) {
    console.log('\n[Preview] [DRY-RUN] Would post PR comment');
  } else {
    console.log('\n[Preview] Posting release preview comment...');
    const commentBody = buildPreviewCommentBody(snapshots, markdown);
    const poster = new PRCommentPoster(
      githubCtx.repoOwner!,
      githubCtx.repoName!,
      githubCtx.token!,
    );
    await poster.postComment(githubCtx.prNumber!, commentBody);
    console.log('[Preview] Release preview comment posted');
  }

  const changed = snapshots.length > 0;

  console.log('\n[Preview] Done! (preview only — no files written, no tags/releases created)');

  return { success: true, changed, markdown, dryRun: config.dryRun };
}

// ── Helpers ──────────────────────────────────────

function buildPreviewCommentBody(
  snapshots: ConsumedSnapshot[],
  markdown: string,
): string {
  const lines: string[] = [];

  lines.push('## 🚀 Release Preview');
  lines.push('');
  lines.push('> ⚠️ **This is a preview.** This release will be published after this PR is merged.');
  lines.push('');

  if (snapshots.length > 0) {
    lines.push(`**Included PRs:** ${snapshots.map((s) => `#${s.prNumber}`).join(', ')}`);
    lines.push('');
  }

  lines.push('### 📝 Changelog:');
  lines.push(markdown);

  return lines.join('\n');
}

// ── CLI Command ─────────────────────────────────

export const previewCommand: Command = new Command('preview')
  .description(
    `Stage 2: Consume all PR changelog snapshots and post a preview comment.

Intended for use when a PR targets the base branch (e.g. main).
Does NOT write CHANGELOG.md, create tags, or publish releases.

Examples:
  release preview                       # post preview comment on current PR
  release preview --dry-run             # preview output without posting`,
  )
  .option('--dry-run', 'Preview output without posting PR comment', false)
  .action(async (options) => {
    try {
      await runPreview(process.cwd(), options.dryRun);
    } catch (error) {
      console.error('[release preview] Failed:', error);
      process.exit(1);
    }
  });
