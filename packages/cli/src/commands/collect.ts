import { Command } from 'commander';
import { collectPRLog } from '@release-toolkit/core';
import { createLogger } from '../logger.js';

const logger = createLogger('collect');

export const collectCommand = new Command('collect')
  .description('收集 PR 日志，把结构化变更写入 PR 描述体（prLogCollector）')
  .requiredOption('--pr-number <number>', 'PR 编号')
  .requiredOption('--owner <owner>', '仓库所有者')
  .requiredOption('--repo <repo>', '仓库名称')
  .option('--token <token>', 'GitHub Token，默认读取 GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  .option('--save', '保存快照到 .release-toolkit/releases/', true)
  .option('--no-save', '不保存快照')
  .option('--cwd <path>', '工作目录', process.cwd())
  .option(
    '--config-path <path>',
    '配置文件路径（相对 --cwd 或绝对路径），默认 .release-toolkit/config.json',
  )
  .addHelpText(
    'after',
    `
示例：
  $ release collect --pr-number 123 --owner my-org --repo my-repo
  $ release collect --pr-number 123 --owner my-org --repo my-repo --no-save
  $ release collect --pr-number 123 --owner my-org --repo my-repo --config-path ./config.release.json
`,
  )
  .action(async (options) => {
    const prNumber = Number.parseInt(options.prNumber, 10);
    if (!Number.isFinite(prNumber) || prNumber <= 0) {
      logger.error(`--pr-number 必须是正整数：${options.prNumber}`);
      process.exit(1);
    }

    const result = await collectPRLog({
      prNumber,
      owner: options.owner,
      repo: options.repo,
      token: options.token,
      save: options.save,
      cwd: options.cwd,
      configPath: options.configPath,
    });

    if (result.success) {
      logger.success(`PR #${result.prNumber} 日志收集成功`);
      if (result.savedPath) {
        logger.detail(`快照已保存：${result.savedPath}`);
      }
    } else {
      logger.error(`收集失败：${result.error}`);
      process.exit(1);
    }
  });
