#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ciCommand } from './commands/ci.command.js';
import { previewCommand } from './commands/preview.command.js';
import { initCommand } from './commands/init.command.js';
import { prChangelogCommand } from './commands/pr-changelog.command.js';

const program = new Command();

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

program
  .name('release')
  .description('CI-driven release tool: version detection → changelog → tags → GitHub Release → hooks')
  .version(version);

// Register commands
program.addCommand(ciCommand);
program.addCommand(previewCommand);
program.addCommand(initCommand);
program.addCommand(prChangelogCommand);

// Parse and execute
program.parseAsync().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
