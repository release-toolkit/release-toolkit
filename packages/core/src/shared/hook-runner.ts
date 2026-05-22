import type { IPlugin, ReleaseHookContext, PRLogCollectorResult, ReleasePreviewResult, ReleasePublisherResult } from './types.js';

/**
 * 插件生命周期钩子执行结果
 *
 * > 与 `features/release-publisher/hook-runner.ts` 中的 `HookResult` 不同：
 * > - 这里描述「插件」执行成功/失败；
 * > - 那边描述「外部 command/script/package」执行成功/失败。
 */
export interface PluginHookResult {
  plugin: string;
  hook: string;
  success: boolean;
  error?: string;
}

/** @deprecated 已重命名为 `PluginHookResult`，保留以保证向后兼容 */
export type HookResult = PluginHookResult;

/**
 * 插件生命周期钩子调度器
 *
 * 在 `collectPRLog` / `previewRelease` / `publishRelease` 执行前后
 * 调用每个 `IPlugin` 的 `beforeCollect`/`afterCollect` 等钩子。
 *
 * > `PluginHookRunner` 与 `features/release-publisher/hook-runner.ts` 中的 `runHooks` 同名易混淆：
 * > 后者负责执行配置在 `releasePublisher.afterRelease` 等数组中的 shell/script/package 钩子。
 */
export class PluginHookRunner {
  private plugins: IPlugin[];

  constructor(plugins: IPlugin[]) {
    this.plugins = plugins;
  }

  /**
   * 设置插件列表
   */
  setPlugins(plugins: IPlugin[]): void {
    this.plugins = plugins;
  }

  /**
   * 执行 PR 日志收集前钩子
   */
  async runBeforeCollect(context: ReleaseHookContext): Promise<HookResult[]> {
    return this.runHooks('beforeCollect', (plugin) => plugin.beforeCollect?.(context));
  }

  /**
   * 执行 PR 日志收集后钩子
   */
  async runAfterCollect(context: ReleaseHookContext, result: PRLogCollectorResult): Promise<HookResult[]> {
    return this.runHooks('afterCollect', (plugin) => plugin.afterCollect?.(context, result));
  }

  /**
   * 执行发布预览前钩子
   */
  async runBeforePreview(context: ReleaseHookContext): Promise<HookResult[]> {
    return this.runHooks('beforePreview', (plugin) => plugin.beforePreview?.(context));
  }

  /**
   * 执行发布预览后钩子
   */
  async runAfterPreview(context: ReleaseHookContext, result: ReleasePreviewResult): Promise<HookResult[]> {
    return this.runHooks('afterPreview', (plugin) => plugin.afterPreview?.(context, result));
  }

  /**
   * 执行发布前钩子
   */
  async runBeforePublish(context: ReleaseHookContext): Promise<HookResult[]> {
    return this.runHooks('beforePublish', (plugin) => plugin.beforePublish?.(context));
  }

  /**
   * 执行发布后钩子
   */
  async runAfterPublish(context: ReleaseHookContext, result: ReleasePublisherResult): Promise<HookResult[]> {
    return this.runHooks('afterPublish', (plugin) => plugin.afterPublish?.(context, result));
  }

  /**
   * 执行钩子并收集结果
   */
  private async runHooks<T>(
    hookName: string,
    executor: (plugin: IPlugin) => Promise<T | void> | T | void,
  ): Promise<PluginHookResult[]> {
    const results: PluginHookResult[] = [];

    for (const plugin of this.plugins) {
      if (!(hookName in plugin)) {
        continue;
      }

      try {
        await executor(plugin);
        results.push({
          plugin: plugin.name,
          hook: hookName,
          success: true,
        });
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        results.push({
          plugin: plugin.name,
          hook: hookName,
          success: false,
          error,
        });
      }
    }

    return results;
  }
}

/** @deprecated 已重命名为 `PluginHookRunner`，保留以保证向后兼容 */
export const HookRunner = PluginHookRunner;
