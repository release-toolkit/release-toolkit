import { Command } from 'commander';
import { CiRunner } from '@release-toolkit/core';

export const ciCommand: Command = new Command('ci')
  .description(
    `Full CI pipeline: version detection → changelog → write file → git tags → GitHub Release → hooks

Examples:
  release ci                              # full pipeline (reads config from .releasetoolkit/config.json)
  release ci --base dev                   # compare against 'dev' branch
  release ci --dry-run                   # preview output without side effects`,
  )
  .option('-b, --base <ref>', 'Base branch/commit to compare against', 'main')
  .option('--dry-run', 'Preview output without writing files, creating tags, or posting comments', false)
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
