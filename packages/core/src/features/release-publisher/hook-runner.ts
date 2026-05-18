/**
 * Hook 执行器
 * 支持三种执行方式：command（shell）、script（文件）、package（npm 包）
 */

import { exec } from 'node:child_process';
import { createRequire } from 'node:module';
import type { AfterReleaseHook, HookCommand } from '../../shared/config/index.js';
import type { ReleaseHookContext } from '../../shared/types.js';

/** 钩子类型枚举 */
export type HookType = 'beforeTag' | 'afterTag' | 'afterRelease' | 'onError';

/** 钩子执行结果 */
export interface HookResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * 执行单个钩子
 */
export async function runHook(
  hook: AfterReleaseHook,
  context: ReleaseHookContext,
  cwd?: string,
): Promise<HookResult> {
  const command = normalizeHookCommand(hook);

  if (!command) {
    return { success: false, error: '未知的钩子类型' };
  }

  try {
    switch (command.type) {
      case 'command':
        return executeCommand(command.command!, context, cwd);
      case 'script':
        return executeScript(command.script!, context, cwd);
      case 'package':
        return executePackage(command.name!, command.args ?? [], context, cwd);
      default:
        return { success: false, error: `不支持的钩子类型: ${command.type}` };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * 批量执行钩子
 */
export async function runHooks(
  hooks: AfterReleaseHook[],
  context: ReleaseHookContext,
  cwd?: string,
): Promise<Array<{ hook: string; result: HookResult }>> {
  const results: Array<{ hook: string; result: HookResult }> = [];

  for (const hook of hooks) {
    const result = await runHook(hook, context, cwd);
    results.push({
      hook: hook.type || hook.run?.type || 'unknown',
      result,
    });
  }

  return results;
}

/**
 * 执行钩子并返回是否全部成功
 */
export async function runHooksAndCheck(
  hooks: AfterReleaseHook[],
  context: ReleaseHookContext,
  cwd?: string,
): Promise<{ allSuccess: boolean; results: Array<{ hook: string; result: HookResult }> }> {
  const results = await runHooks(hooks, context, cwd);
  const allSuccess = results.every((r) => r.result.success);
  return { allSuccess, results };
}

// ==================== 命令执行 ====================

/**
 * 执行 shell 命令（异步）
 */
async function executeCommand(
  command: string,
  context: ReleaseHookContext,
  cwd?: string,
): Promise<HookResult> {
  const env = buildHookEnv(context, cwd);
  const workingDir = cwd || process.cwd();

  return new Promise((resolve) => {
    exec(command, { cwd: workingDir, env }, (error, stdout, stderr) => {
      if (error) {
        resolve({
          success: false,
          error: error.message || stderr?.trim() || '命令执行失败',
        });
      } else {
        resolve({ success: true, output: stdout?.trim() });
      }
    });
  });
}

/**
 * 执行脚本文件
 */
async function executeScript(
  scriptPath: string,
  context: ReleaseHookContext,
  cwd?: string,
): Promise<HookResult> {
  const scriptCwd = cwd || process.cwd();
  const resolvedPath = scriptPath.startsWith('/') ? scriptPath : `${scriptCwd}/${scriptPath}`;

  // 根据文件扩展名确定如何执行
  const ext = resolvedPath.split('.').pop()?.toLowerCase();
  const nodeCommand = `node "${resolvedPath}"`;
  const bashCommand = `bash "${resolvedPath}"`;
  const command = ext === 'js' || ext === 'ts' || ext === 'mjs' || ext === 'cjs' ? nodeCommand : bashCommand;

  return executeCommand(command, context, cwd);
}

/**
 * 执行 npm 包
 */
async function executePackage(
  packageName: string,
  args: string[],
  context: ReleaseHookContext,
  cwd?: string,
): Promise<HookResult> {
  const scriptCwd = cwd || process.cwd();

  try {
    // 动态加载包
    const require = createRequire(import.meta.url);
    const module = require(packageName);

    // 查找 CLI 入口
    const cli = module.cli || module.default || module;

    if (typeof cli === 'function') {
      // 直接调用函数
      const result = await cli({
        ...context,
        args,
        cwd: scriptCwd,
      });
      return { success: true, output: typeof result === 'string' ? result : undefined };
    }

    if (Array.isArray(cli)) {
      // 支持 commander 等 CLI 框架的数组格式
      const command = cli.join(' ');
      return executeCommand(`node -e "require('${packageName}').parse(process.argv)" ${command}`, context, cwd);
    }

    return {
      success: false,
      error: `包 ${packageName} 不支持作为钩子执行，请检查包的导出`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * 构建钩子执行环境变量
 */
function buildHookEnv(context: ReleaseHookContext, cwd?: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    // Release 信息
    RELEASE_PACKAGE_NAME: context.packageName,
    RELEASE_OLD_VERSION: context.oldVersion,
    RELEASE_NEW_VERSION: context.newVersion,
    RELEASE_TAG_NAME: context.tagName,
    // 版本类型
    RELEASE_VERSION_TYPE: detectVersionType(context.oldVersion, context.newVersion),
    // 工作目录
    ...(cwd && { RELEASE_CWD: cwd }),
  };
}

/**
 * 检测版本类型
 */
function detectVersionType(oldVersion: string, newVersion: string): string {
  try {
    const { compare } = require('semver');
    const v1 = oldVersion.split('-')[0] || oldVersion;
    const v2 = newVersion.split('-')[0] || newVersion;
    const c = compare(v1, v2);
    if (c < 0) {
      const p1 = v1.split('.').map(Number);
      const p2 = v2.split('.').map(Number);
      if (p2[0] > p1[0]) return 'major';
      if (p2[1] > p1[1]) return 'minor';
      if (p2[2] > p1[2]) return 'patch';
    }
    return 'patch';
  } catch {
    return 'unknown';
  }
}

/**
 * 标准化钩子命令配置
 */
function normalizeHookCommand(hook: AfterReleaseHook): HookCommand | null {
  // 新格式：使用 run 字段
  if (hook.run) {
    return hook.run;
  }

  // 命令类型
  if (hook.type === 'command' || hook.type === 'custom' || hook.type === 'npm-publish') {
    return { type: 'command', command: hook.command || '' };
  }

  // 脚本类型
  if (hook.type === 'script') {
    return { type: 'script', script: hook.script || '' };
  }

  // 包类型
  if (hook.type === 'package') {
    return { type: 'package', name: hook.name || '', args: hook.args ?? [] };
  }

  // 自动检测
  if (hook.command) {
    return { type: 'command', command: hook.command };
  }
  if (hook.script) {
    return { type: 'script', script: hook.script };
  }
  if (hook.name) {
    return { type: 'package', name: hook.name, args: hook.args ?? [] };
  }

  return null;
}
