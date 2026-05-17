import type { IPlugin, ReleaseHookContext, PRLogCollectorResult, ReleasePreviewResult, ReleasePublisherResult } from './types.js';

/**
 * 钩子执行结果
 */
export interface HookResult {
  plugin: string;
  hook: string;
  success: boolean;
  error?: string;
}

/**
 * 钩子执行器
 * 在各 feature 执行前后调用插件的生命周期钩子
 */
export class HookRunner {
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
  ): Promise<HookResult[]> {
    const results: HookResult[] = [];

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
