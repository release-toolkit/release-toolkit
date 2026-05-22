import { DEFAULT_PLUGINS } from '../../constants.js';
import type {
  ChangelogEntry,
  ChangelogFormatter,
  IPlugin,
  ILogParser,
} from './types.js';

/** 加载插件结果（同时返回 IPlugin 和 ChangelogFormatter） */
export interface LoadPluginsResult {
  /** IPlugin 数组（支持生命周期钩子） */
  plugins: IPlugin[];
  /** 格式化器数组（兼容旧代码） */
  formatters: ChangelogFormatter[];
  /** 加载错误信息 */
  errors: string[];
}

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

/**
 * 加载插件
 * @param pluginNames 插件名称数组，默认为 DEFAULT_PLUGINS
 * @returns 加载的插件和错误信息
 */
export async function loadPlugins(pluginNames?: string[]): Promise<LoadPluginsResult> {
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

  return { plugins: [], formatters, errors };
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
 * 加载插件为 IPlugin 类型
 * @param pluginNames 插件名称数组
 * @returns 加载的 IPlugin 数组和错误信息
 */
export async function loadPluginsAsIPlugin(
  pluginNames?: string[],
): Promise<LoadPluginsResult> {
  const names = pluginNames || [];
  const plugins: IPlugin[] = [];
  const formatters: ChangelogFormatter[] = [];
  const errors: string[] = [];

  for (const name of names) {
    try {
      const plugin = await loadPluginAsIPlugin(name);
      if (plugin) {
        plugins.push(plugin);
        // 同时收集格式化器（兼容旧代码）
        if ('format' in plugin || 'formatLine' in plugin) {
          formatters.push(plugin as unknown as ChangelogFormatter);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`插件 ${name} 加载失败: ${msg}`);
    }
  }

  return { plugins, formatters, errors };
}

/**
 * 加载单个插件为 IPlugin 类型
 * @param name 插件名称、文件路径或模块名
 */
async function loadPluginAsIPlugin(
  name: string,
): Promise<(IPlugin & ChangelogFormatter) | null> {
  // 1. 尝试作为内置插件加载
  if (BUILTIN_PLUGINS[name]) {
    const formatter = await BUILTIN_PLUGINS[name]();
    return {
      ...formatter,
      name: formatter.name,
    } as IPlugin & ChangelogFormatter;
  }

  // 2. 尝试作为文件路径加载
  if (name.startsWith('.') || name.startsWith('/') || name.includes('/')) {
    const mod = await import(name);
    const plugin = mod.default || mod;
    // 支持 IPlugin 或 ChangelogFormatter
    if ('beforeCollect' in plugin) {
      return plugin as IPlugin;
    }
    if ('format' in plugin || 'formatLine' in plugin) {
      return plugin as ChangelogFormatter;
    }
    return plugin;
  }

  // 3. 尝试作为 npm 模块加载
  try {
    const mod = await import(name);
    const plugin = mod.default || mod;
    if ('beforeCollect' in plugin) {
      return plugin as IPlugin;
    }
    if ('format' in plugin || 'formatLine' in plugin) {
      return plugin as ChangelogFormatter;
    }
    return plugin;
  } catch {
    // 忽略
  }

  throw new Error(`无法加载插件: ${name}`);
}

/**
 * 加载日志解析器
 * @param parserName 解析器名称
 * @returns ILogParser 实例
 */
export async function loadLogParser(
  parserName: string,
): Promise<ILogParser> {
  // 内置解析器
  if (parserName === 'default') {
    const { parseChangelog } = await import('./utils.js');
    return {
      name: 'default',
      parse: parseChangelog,
    };
  }

  // 自定义解析器
  if (parserName.startsWith('.') || parserName.startsWith('/') || parserName.includes('/')) {
    const mod = await import(parserName);
    const parser = mod.default || mod;
    if ('parse' in parser) {
      return parser as ILogParser;
    }
  }

  throw new Error(`无法加载日志解析器: ${parserName}`);
}

/**
 * 应用格式化器到 changelog 条目
 * @param entries changelog 条目数组
 * @param formatters 格式化器数组
 * @returns 格式化后的字符串
 */
export function applyFormatters(
  entries: ChangelogEntry[],
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

/**
 * 应用格式化器到原始文本行
 * @param text 原始文本
 * @param formatters 格式化器数组（需支持 formatLine）
 * @returns 格式化后的文本
 */
export function applyFormatLine(
  text: string,
  formatters: ChangelogFormatter[],
): string {
  const lines = text.split('\n');
  return lines
    .map((line) => {
      let formatted = line;
      for (const formatter of formatters) {
        if (typeof formatter.formatLine === 'function') {
          formatted = formatter.formatLine(formatted);
        }
      }
      return formatted;
    })
    .join('\n');
}
