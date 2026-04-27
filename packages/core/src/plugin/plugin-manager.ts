import {
  IPlugin,
  ILineFormatter,
  ILogFormatter,
  ChangeLogEntry,
  ChangeLogOutput,
} from '../types.js';
import { resolve } from 'node:path';

export class PluginManager {
  private lineFormatters: ILineFormatter[] = [];
  private logFormatters: ILogFormatter[] = [];
  private plugins: Map<string, IPlugin> = new Map();
  private cwd: string;
  /** Track plugins matched by fallback (no __formatterType) to avoid dual registration */
  private fallbackMatched = new Set<string>();

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  /** Register a plugin instance */
  register(plugin: IPlugin): void {
    this.plugins.set(plugin.name, plugin);

    if (this.isLineFormatter(plugin)) {
      this.lineFormatters.push(plugin);
    }

    if (this.isLogFormatter(plugin)) {
      this.logFormatters.push(plugin);
    }
  }

  /** Register a plugin by name string (for built-in plugins) */
  async loadByName(name: string): Promise<void> {
    try {
      // Dynamic import for external or built-in plugins
      // This allows lazy-loading of octokit-dependent plugins etc.
      const module = await import(
        /* @vite-ignore */
        name.startsWith('.') || name.startsWith('/')
          ? resolveImportPath(this.cwd, name)
          : `@release-toolkit/changelog-presets/dist/formatters/${name}.js`
      );

      const pluginFactory = module.default || module;
      const plugin =
        typeof pluginFactory === 'function'
          ? await pluginFactory()
          : pluginFactory;

      if (plugin && typeof plugin.name === 'string') {
        this.register(plugin);
        console.log(`[PluginManager] Loaded plugin: ${plugin.name}`);
      }
    } catch (error) {
      console.error(`[PluginManager] Failed to load plugin "${name}":`, error);
    }
  }

  getRegisteredNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  private isLineFormatter(plugin: IPlugin): plugin is ILineFormatter {
    const p = plugin as ILineFormatter;
    if (p.__formatterType !== undefined) {
      return p.__formatterType === 'line';
    }
    // Fallback for plugins without __formatterType: match only once, default to line
    if ('format' in plugin && typeof p.format === 'function' && !this.fallbackMatched.has(plugin.name)) {
      this.fallbackMatched.add(plugin.name);
      console.warn(
        `[PluginManager] Plugin "${plugin.name}" has no __formatterType. ` +
          `Defaulting to LineFormatter. Add __formatterType: 'line' or 'log' for explicit discrimination.`,
      );
      return true;
    }
    return false;
  }

  private isLogFormatter(plugin: IPlugin): plugin is ILogFormatter {
    const p = plugin as ILogFormatter;
    if (p.__formatterType !== undefined) {
      return p.__formatterType === 'log';
    }
    // Fallback: already claimed by isLineFormatter, do not double-register
    if ('format' in plugin && typeof p.format === 'function' && !this.fallbackMatched.has(plugin.name)) {
      this.fallbackMatched.add(plugin.name);
      console.warn(
        `[PluginManager] Plugin "${plugin.name}" has no __formatterType. ` +
          `Defaulting to LogFormatter. Add __formatterType: 'line' or 'log' for explicit discrimination.`,
      );
      return true;
    }
    return false;
  }
}

/** Helper to resolve import path relative to cwd */
function resolveImportPath(cwd: string, importPath: string): string {
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return resolve(cwd, importPath);
  }
  return importPath;
}
