import { Command } from 'commander';
import { collectPRLog } from '@release-toolkit/core';

export const collectCommand = new Command('collect')
  .description('收集 PR 日志（prLogCollector）')
  .requiredOption('--pr-number <number>', 'PR 编号')
  .requiredOption('--owner <owner>', '仓库所有者')
  .requiredOption('--repo <repo>', '仓库名称')
  .option('--token <token>', 'GitHub Token', process.env.GITHUB_TOKEN)
  .option('--save', '保存快照到本地', true)
  .option('--cwd <path>', '工作目录', process.cwd())
  .action(async (options) => {
    const result = await collectPRLog({
      prNumber: parseInt(options.prNumber, 10),
      owner: options.owner,
      repo: options.repo,
      token: options.token,
      save: options.save,
      cwd: options.cwd,
    });

    if (result.success) {
      console.log(`✅ PR #${result.prNumber} 日志收集成功`);
      if (result.savedPath) {
        console.log(`快照已保存：${result.savedPath}`);
      }
    } else {
      console.error(`❌ 收集失败：${result.error}`);
      process.exit(1);
    }
  });
