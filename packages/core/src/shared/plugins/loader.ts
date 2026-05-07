import { DEFAULT_PLUGINS } from '../../constants.js';
import type { ChangelogFormatter } from './types.js';

/**
 * 插件加载器
 * 支持内置插件和自定义插件（文件路径或模块名）
 */

// 内置插件映射（懒加载）
const BUILTIN_PLUGINS: Record<string, () => Promise<ChangelogFormatter>> = {
  'emoji-prefix': async () => {
    const { emojiPrefix } = await import('@release-toolkit/changelog-presets');
    return emojiPrefix;
  },
  'category-group': async () => {
    const { categoryGroup } = await import('@release-toolkit/changelog-presets');
    return categoryGroup;
  },
  'markdown-bold': async () => {
    const { markdownBold } = await import('@release-toolkit/changelog-presets');
    return markdownBold;
  },
};

export interface LoadedPlugins {
  formatters: ChangelogFormatter[];
  errors: string[];
}

/**
 * 加载插件
 * @param pluginNames 插件名称数组，默认为 DEFAULT_PLUGINS
 * @returns 加载的插件和错误信息
 */
export async function loadPlugins(pluginNames?: string[]): Promise<LoadedPlugins> {
  const names = pluginNames || [...DEFAULT_PLUGINS];
  const formatters: ChangelogFormatter[] = [];
  const errors: string[] = [];

  for (const name of names) {
    try {
      const formatter = await loadPlugin(name);
      if (formatter) {
        formatters.push(formatter);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`插件 ${name} 加载失败: ${msg}`);
    }
  }

  return { formatters, errors };
}

/**
 * 加载单个插件
 * @param name 插件名称、文件路径或模块名
 */
async function loadPlugin(name: string): Promise<ChangelogFormatter | null> {
  // 1. 尝试作为内置插件加载
  if (BUILTIN_PLUGINS[name]) {
    return await BUILTIN_PLUGINS[name]();
  }

  // 2. 尝试作为文件路径加载
  if (name.startsWith('.') || name.startsWith('/') || name.includes('/')) {
    const mod = await import(name);
    return mod.default || mod;
  }

  // 3. 尝试作为 npm 模块加载
  try {
    const mod = await import(name);
    return mod.default || mod;
  } catch {
    // 忽略
  }

  throw new Error(`无法加载插件: ${name}`);
}

/**
 * 应用格式化器到 changelog 条目
 * @param entries changelog 条目数组
 * @param formatters 格式化器数组
 * @returns 格式化后的字符串
 */
export function applyFormatters(
  entries: Array<{ type: string; scope?: string; subject: string }>,
  formatters: ChangelogFormatter[],
): string {
  if (formatters.length === 0) {
    // 无插件，返回默认格式
    return entries.map((entry) => {
      const scope = entry.scope ? `**${entry.scope}**: ` : '';
      return `- ${scope}${entry.subject}`;
    }).join('\n');
  }

  // 使用第一个支持 format 的格式化器
  for (const formatter of formatters) {
    if (formatter.format) {
      return formatter.format(entries);
    }
  }

  // 如果没有格式化器支持 format，使用 formatLine
  const lines = entries.map((entry) => {
    let line = `- ${entry.scope ? `**${entry.scope}**: ` : ''}${entry.subject}`;
    for (const formatter of formatters) {
      if (formatter.formatLine) {
        line = formatter.formatLine(line);
      }
    }
    return line;
  });

  return lines.join('\n');
}
