import { Command } from 'commander';
import { CiRunner } from '@release-toolkit/core';

export const ciCommand: Command = new Command('ci')
  .description(
    `CI mode: detect version changes → read changelog files → format via plugins → write CHANGELOG.md → update PR comment

Examples:
  release ci --base main
  release ci --base main --changelog-dir .changelog --output CHANGELOG.md --comment-pr --plugins emoji-prefix category-group
  release ci --dry-run`,
  )
  .option('-b, --base <ref>', 'Base branch/commit to compare against', 'main')
  .option(
    '-c, --changelog-dir <dir>',
    'Directory containing accumulated changelog JSON files',
    '.changelog',
  )
  .option('-o, --output <path>', 'Output file path for generated changelog', 'CHANGELOG.md')
  .option('--comment-pr', 'Post the report as a PR comment (requires GitHub Actions context)', true)
  .option('--no-comment-pr', 'Skip posting PR comment')
  .option('--dry-run', 'Preview output without writing files or posting comments', false)
  .option(
    '-p, --plugins <names...>',
    'Plugin names to enable (default: emoji-prefix category-group)',
    ['emoji-prefix', 'category-group'],
  )
  .action(async (options) => {
    try {
      const runner = new CiRunner(
        {
          baseRef: options.base,
          changelogDir: options.changelogDir,
          outputPath: options.output,
          commentPr: options.commentPr,
          dryRun: options.dryRun,
          plugins: options.plugins,
        },
        process.cwd(),
      );

      const result = await runner.run();

      // Exit with non-zero if no changes detected (useful for CI gating)
      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      console.error('[release ci] Failed:', error);
      process.exit(1);
    }
  });
