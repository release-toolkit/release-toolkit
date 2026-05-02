import { Command } from 'commander';
import { Stage3ReleasePublisher } from '@release-toolkit/core';

export const ciCommand: Command = new Command('ci')
  .description(
    `Stage 3: Full CI pipeline - publish releases.

Reads config from .releasetoolkit/config.json
Consumes Stage 2 output from .releasetoolkit/release/info.json

Examples:
  release ci                              # full pipeline (reads config from .releasetoolkit/config.json)
  release ci --base dev                   # compare against 'dev' branch
  release ci --dry-run                   # preview output without side effects`,
  )
  .option('-b, --base <ref>', 'Base branch/commit to compare against', 'main')
  .option('--dry-run', 'Preview output without writing files, creating tags, or posting comments', false)
  .action(async (options) => {
    try {
      const publisher = new Stage3ReleasePublisher(
        {
          ...options,
          cwd: process.cwd(),
        },
      );

      const result = await publisher.run();

      if (!result.success) {
        process.exit(1);
      }
    } catch (error) {
      console.error('[release ci] Failed:', error);
      process.exit(1);
    }
  });
