#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pc from 'picocolors';
import { collectCommand } from './commands/collect.js';
import { previewCommand } from './commands/preview.js';
import { publishCommand } from './commands/publish.js';

const program = new Command();

const __dirname = dirname(fileURLToPath(import.meta.url));
const { version } = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'),
);

program
  .name('release')
  .description(
    [
      'release-toolkit：Monorepo PR 日志 / 版本预览 / 发布工具',
      '',
      '工作流：',
      '  1. PR 提交  → release collect  写入 PR 描述体',
      '  2. PR 预览  → release preview  检测版本变更并评论',
      '  3. PR 合并  → release publish  创建 Git Tag + GitHub Release',
    ].join('\n'),
  )
  .version(version)
  .addHelpText(
    'after',
    `
更多信息：
  - 完整文档：https://github.com/release-toolkit/release-toolkit
  - 配置参考：.release-toolkit/config.json（可用 --config-path 覆盖）
  - GitHub Actions 模板：.github/workflows/release-{collect,publish}.yml
`,
  );

program.addCommand(collectCommand);
program.addCommand(previewCommand);
program.addCommand(publishCommand);

program.parseAsync().catch((err) => {
  console.error(
    `${pc.blue('[release]')} ${pc.red('✗')} 未捕获错误：`,
    err instanceof Error ? err.message : String(err),
  );
  process.exit(1);
});
