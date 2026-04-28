import { Command } from 'commander';
import { initConfig } from '@release-toolkit/core';

export const initCommand: Command = new Command('init')
  .description(
    `Initialize .releasetoolkit/config.json in current directory.

Creates a minimal config file with sensible defaults.
If config already exists, does nothing (safe to re-run).

Example:
  release init`,
  )
  .action(async () => {
    try {
      const result = initConfig(process.cwd());

      if (result.created) {
        console.log(`✓ Created ${result.path}`);
        console.log('  You can edit this file to customize packagesDir, rootTag, packageMap, etc.');
      } else {
        console.log(`ℹ Config already exists at ${result.path}`);
        console.log('  Edit it directly to change settings.');
      }
    } catch (error) {
      console.error('[release init] Failed:', error);
      process.exit(1);
    }
  });
