import { Command } from 'commander';
import { publishRelease } from '@release-toolkit/core';

export const publishCommand = new Command('publish')
  .description('发布版本（releasePublisher）')
  .option('--dry-run', ' dry run，不实际创建 Release', false)
  .option('--cwd <path>', '工作目录', process.cwd())
  .action(async (options) => {
    const result = await publishRelease({
      cwd: options.cwd,
      dryRun: options.dryRun,
    });

    if (result.success) {
      console.log(`✅ 发布完成，共 ${result.releases.length} 个 Release`);
      for (const rel of result.releases) {
        console.log(`  - ${rel.packageName} → ${rel.releaseUrl || rel.tagName}`);
      }
    } else {
      console.error(`❌ 发布失败：`);
      for (const err of result.errors) {
        console.error(`  - ${err}`);
      }
      process.exit(1);
    }
  });
