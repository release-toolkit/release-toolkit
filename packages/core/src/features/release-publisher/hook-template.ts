import type { ReleaseHookContext } from '../../shared/types.js';

/** 将 `{{packageName}}` 等占位符替换为发布上下文值 */
export function interpolateHookTemplate(
  template: string,
  context: ReleaseHookContext,
): string {
  return template
    .replace(/\{\{packageName\}\}/g, context.packageName)
    .replace(/\{\{oldVersion\}\}/g, context.oldVersion)
    .replace(/\{\{newVersion\}\}/g, context.newVersion)
    .replace(/\{\{tagName\}\}/g, context.tagName);
}
