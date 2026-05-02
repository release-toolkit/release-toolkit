#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { collectCommand } from './commands/collect.js';
import { previewCommand } from './commands/preview.js';
import { publishCommand } from './commands/publish.js';

const program = new Command();

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
);

program
  .name('release')
  .description('release-toolkit: prLogCollector → releasePreview → releasePublisher')
  .version(version);

// Register 3 core commands
program.addCommand(collectCommand);
program.addCommand(previewCommand);
program.addCommand(publishCommand);

// Parse and execute
program.parseAsync().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
