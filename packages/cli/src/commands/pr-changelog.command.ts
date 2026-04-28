import { Command } from 'commander';
import {
  fetchPRData,
  savePRChangelog,
  listPRChangeLogs,
  renderPRChangelogMD,
} from '@release-toolkit/core';
import type { SavePRChangelogOptions } from '@release-toolkit/core';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Resolve a value from option flag → environment variable → undefined.
 */
function resolveValue<T>(optionValue: T | undefined, envKey: string): T | undefined {
  if (optionValue !== undefined) return optionValue;
  const env = process.env[envKey];
  if (env !== undefined) return env as unknown as T;
  return undefined;
}

/** Read file content and print to stdout */
function printFile(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  process.stdout.write(content);
}

// ── Main command ──────────────────────────────────────────────
export const prChangelogCommand: Command = new Command('pr-changelog')
  .description('PR-level changelog: fetch, render, save, and list PR change records');

// ── Sub-command: fetch ────────────────────────────────────────
prChangelogCommand
  .command('fetch')
  .description(
    `Fetch PR data from GitHub, render changelog markdown, and optionally save it.

Resolves owner/repo/token from:
  1. CLI options (--owner, --repo, --token)
  2. Environment variables (GITHUB_REPOSITORY, GITHUB_TOKEN)

Examples:
  release pr-changelog fetch --pr-number 123
  release pr-changelog fetch --pr-number 123 --owner myorg --repo myrepo
  release pr-changelog fetch --pr-number 123 --save
  release pr-changelog fetch --pr-number 123 --save --skip-if-exists`,
  )
  .requiredOption('--pr-number <number>', 'PR number')
  .option('--owner <owner>', 'GitHub owner/org', '')
  .option('--repo <repo>', 'GitHub repository name', '')
  .option('--token <token>', 'GitHub personal access token (or use GITHUB_TOKEN env)')
  .option('--save', 'Save rendered markdown to .releasetoolkit/changelog/prs/', false)
  .option('--skip-if-exists', 'Skip saving if file already exists (implies --save)', false)
  .action(async (options) => {
    try {
      // ── Resolve credentials ──
      let { owner, repo, token } = options;

      token = resolveValue(token, 'GITHUB_TOKEN');
      if (!token) {
        console.error('[pr-changelog] Error: --token or GITHUB_TOKEN is required');
        process.exit(1);
      }

      // Parse GITHUB_REPOSITORY format "owner/repo" as fallback
      if (!owner || !repo) {
        const ghRepo = process.env.GITHUB_REPOSITORY;
        if (ghRepo) {
          const [envOwner, envRepo] = ghRepo.split('/');
          owner ||= envOwner || '';
          repo ||= envRepo || '';
        }
      }

      if (!owner || !repo) {
        console.error('[pr-changelog] Error: --owner/--repo or GITHUB_REPOSITORY ("owner/repo") is required');
        process.exit(1);
      }

      const prNumber = parseInt(options.prNumber, 10);
      if (isNaN(prNumber) || prNumber <= 0) {
        console.error('[pr-changelog] Error: --pr-number must be a positive integer');
        process.exit(1);
      }

      // ── Fetch & render ──
      console.log(`[pr-changelog] Fetching PR #${prNumber} from ${owner}/${repo}...`);
      const data = await fetchPRData({
        owner,
        repo,
        token,
        prNumber,
      });

      const md = renderPRChangelogMD(data);

      // Print to stdout
      process.stdout.write(md + '\n');

      // ── Optionally save ──
      const shouldSave = options.save || options.skipIfExists;
      if (shouldSave) {
        const saveOptions: SavePRChangelogOptions = {
          overwrite: options.skipIfExists ? 'skip' : 'overwrite',
        };
        const savedPath = savePRChangelog(process.cwd(), data, saveOptions);

        if (savedPath) {
          const relPath = path.relative(process.cwd(), savedPath);
          if (fs.existsSync(savedPath) && options.skipIfExists) {
            console.log(`[pr-changelog] ℹ Skipped (already exists): ${relPath}`);
          } else {
            console.log(`[pr-changelog] ✓ Saved: ${relPath}`);
          }
        }
      }
    } catch (error) {
      console.error('[pr-changelog fetch] Failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

// ── Sub-command: list ─────────────────────────────────────────
prChangelogCommand
  .command('list')
  .description(
    `List all saved PR changelog files in .releasetoolkit/changelog/prs/.

Examples:
  release pr-changelog list`,
  )
  .option('--show-content', 'Print content of each file', false)
  .action((options) => {
    try {
      const files = listPRChangeLogs(process.cwd());

      if (files.length === 0) {
        console.log('[pr-changelog] No saved PR changelogs found.');
        console.log('  Run "release pr-changelog fetch --pr-number <N> --save" to create one.');
        return;
      }

      console.log(`[pr-changelog] Found ${files.length} PR changelog(s):\n`);

      for (const file of files) {
        console.log(`  📄 ${file}`);
        if (options.showContent) {
          const filePath = path.join(
            process.cwd(),
            '.releasetoolkit',
            'changelog',
            'prs',
            file,
          );
          if (fs.existsSync(filePath)) {
            const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
            for (const line of lines) {
              console.log(`    ${line}`);
            }
            console.log('');
          }
        }
      }
    } catch (error) {
      console.error('[pr-changelog list] Failed:', error);
      process.exit(1);
    }
  });
