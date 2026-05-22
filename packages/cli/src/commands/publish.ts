import { Command } from 'commander';
import { publishRelease } from '@release-toolkit/core';
import { createLogger } from '../logger.js';

const logger = createLogger('publish');

export const publishCommand = new Command('publish')
  .description('发布版本：创建 Git Tag + GitHub Release + 执行 afterRelease 钩子（releasePublisher）')
  .option('--owner <owner>', '仓库所有者（默认读取 GITHUB_REPOSITORY）')
  .option('--repo <repo>', '仓库名称（默认读取 GITHUB_REPOSITORY）')
  .option('--token <token>', 'GitHub Token，默认读取 GITHUB_TOKEN', process.env.GITHUB_TOKEN)
  .option('--dry-run', '空跑模式，不实际创建 Tag/Release，也不执行钩子', false)
  .option('--cwd <path>', '工作目录', process.cwd())
  .option(
    '--config-path <path>',
    '配置文件路径（相对 --cwd 或绝对路径），默认 .release-toolkit/config.json',
  )
  .addHelpText(
    'after',
    `
示例：
  # 由 CI 自动触发（推荐）
  $ release publish

  # 本地预演（不创建任何资源）
  $ release publish --dry-run

  # 显式指定仓库
  $ release publish --owner my-org --repo my-repo
`,
  )
  .action(async (options) => {
    const result = await publishRelease({
      cwd: options.cwd,
      configPath: options.configPath,
      dryRun: options.dryRun,
      owner: options.owner,
      repo: options.repo,
      token: options.token,
    });

    if (result.success) {
      if (result.releases.length === 0) {
        logger.warn('未检测到版本变更，跳过发布');
      } else {
        logger.success(`发布完成，共 ${result.releases.length} 个 Release`);
        for (const rel of result.releases) {
          logger.detail(`${rel.packageName} → ${rel.releaseUrl || rel.tagName}`);
        }
      }
    } else {
      logger.error('发布失败：');
      for (const err of result.errors) {
        logger.detail(err);
      }
      process.exit(1);
    }
  });
