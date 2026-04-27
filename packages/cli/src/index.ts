#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ciCommand } from './commands/ci.command.js';

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

// Parse and execute
program.parseAsync().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
