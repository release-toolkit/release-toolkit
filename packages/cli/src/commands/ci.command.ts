import { Command } from 'commander';
import { CiRunner } from '@release-toolkit/core';

export const ciCommand: Command = new Command('ci')
  .description(
    `CI mode: detect version changes → generate changelog → create tags → create GitHub Release → run hooks

Full pipeline:
  1. Detect version changes from package.json diffs
  2. Read changelog files, format via plugins
  3. Write CHANGELOG.md, post PR comment
  4. Create git tags for changed packages (@pkg@version format)
  5. Create GitHub Release (auto-detects prerelease from versions)
  6. Run afterRelease hooks with release info as env vars

Examples:
  release ci
  release ci --base develop
  release ci --dry-run`,
  )
  .option('-b, --base <ref>', 'Base branch/commit to compare against', 'main')
  .option('--dry-run', 'Preview output without writing files or posting comments', false)
  .action(async (options) => {
    try {
      const runner = new CiRunner(
        {
          baseRef: options.base,
          dryRun: options.dryRun,
        },
        process.cwd(),
      );

      const result = await runner.run();

      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      console.error('[release ci] Failed:', error);
      process.exit(1);
    }
  });
