/**
 * CLI Command: release prepare
 */

import { Command } from 'commander';
import { Stage2ReleasePreparer } from '@release-toolkit/core';

export const prepareCommand = new Command('prepare')
  .description(
    `Stage 2: Prepare release information from PR snapshots.

Detects version changes and builds release changelog.
Intended for use after PRs are merged to dev branch.

Examples:
  release prepare                       # prepare release info
  release prepare --base main          # compare against 'main' branch
  release prepare --no-save           # preview without saving`,
  )
  .option('-b, --base <ref>', 'Base branch/commit to compare against', 'main')
  .option('-d, --dev <branch>', 'Development branch name', 'dev')
  .option('--no-save', 'Do not save release info to disk', false)
  .action(async (options) => {
    try {
      console.log('=== Release Prepare (Stage 2) ===');

      const preparer = new Stage2ReleasePreparer({
        baseRef: options.base,
        devBranch: options.dev,
        cwd: process.cwd(),
        save: options.save,
      });

      const result = await preparer.run();

      if (!result.success) {
        console.error('[release prepare] Failed:', result.error);
        process.exit(1);
      }

      console.log('\n[release prepare] ✓ Release info prepared successfully');
      console.log(`  - Changed packages: ${result.changedPackages.length}`);
      console.log(`  - PR snapshots consumed: ${result.snapshotCount}`);
      if (result.savedPath) {
        console.log(`  - Saved to: ${result.savedPath}`);
      }
    } catch (error) {
      console.error('[release prepare] Failed:', error);
      process.exit(1);
    }
  });
