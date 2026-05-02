import { Command } from 'commander';
import { previewRelease } from '@release-toolkit/core';

export const previewCommand = new Command('preview')
  .description('版本发布预览（releasePreview）')
  .requiredOption('--pr-number <number>', 'PR 编号')
  .requiredOption('--owner <owner>', '仓库所有者')
  .requiredOption('--repo <repo>', '仓库名称')
  .option('--token <token>', 'GitHub Token', process.env.GITHUB_TOKEN)
  .option('--cwd <path>', '工作目录', process.cwd())
  .action(async (options) => {
    const result = await previewRelease({
      prNumber: parseInt(options.prNumber, 10),
      owner: options.owner,
      repo: options.repo,
      token: options.token,
      cwd: options.cwd,
    });

    if (result.success) {
      if (result.hasVersionChange) {
        console.log(`✅ 发布预览已更新，检测到 ${result.versionDiffs.length} 个包版本变更`);
      } else {
        console.log('⚠️ 未检测到版本变更，已评论提示');
      }
    } else {
      console.error(`❌ 预览失败：${result.error}`);
      process.exit(1);
    }
  });
