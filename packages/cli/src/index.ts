#!/usr/bin/env node
import { Command } from 'commander';
import { ciCommand } from './commands/ci.command.js';

const program = new Command();

program
  .name('release')
  .description('Monorepo release tool - version detection, changelog generation with plugin system')
  .version('0.1.0');

// Register commands
program.addCommand(ciCommand);

// Parse and execute
program.parseAsync().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
