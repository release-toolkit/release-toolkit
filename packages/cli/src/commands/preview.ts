import { Command } from 'commander';
import { previewRelease } from '@release-toolkit/core';
import { createLogger } from '../logger.js';

const logger = createLogger('preview');

export const previewCommand = new Command('preview')
  .description('版本发布预览，检测版本变更 + 聚合日志并评论到 PR（releasePreview）')
  .requiredOption('--pr-number <number>', 'PR 编号')
  .requiredOption('--owner <owner>', '仓库所有者')
  .requiredOption('--repo <repo>', '仓库名称')
  .option('--token <token>', 'GitHub Token，默认读取 GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  .option('--cwd <path>', '工作目录', process.cwd())
  .option(
    '--config-path <path>',
    '配置文件路径（相对 --cwd 或绝对路径），默认 .release-toolkit/config.json',
  )
  .addHelpText(
    'after',
    `
示例：
  $ release preview --pr-number 123 --owner my-org --repo my-repo
`,
  )
  .action(async (options) => {
    const prNumber = Number.parseInt(options.prNumber, 10);
    if (!Number.isFinite(prNumber) || prNumber <= 0) {
      logger.error(`--pr-number 必须是正整数：${options.prNumber}`);
      process.exit(1);
    }

    const result = await previewRelease({
      prNumber,
      owner: options.owner,
      repo: options.repo,
      token: options.token,
      cwd: options.cwd,
      configPath: options.configPath,
    });

    if (result.success) {
      if (result.hasVersionChange) {
        logger.success(`发布预览已更新，检测到 ${result.versionDiffs.length} 个包版本变更`);
      } else {
        logger.warn('未检测到版本变更，已评论提示');
      }
    } else {
      logger.error(`预览失败：${result.error}`);
      process.exit(1);
    }
  });
