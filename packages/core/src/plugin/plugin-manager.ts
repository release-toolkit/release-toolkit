import {
  IPlugin,
  ILineFormatter,
  ILogFormatter,
} from '../types.js';
import { resolve } from 'node:path';

export class PluginManager {
  private lineFormatters: ILineFormatter[] = [];
  private logFormatters: ILogFormatter[] = [];
  private plugins: Map<string, IPlugin> = new Map();
  private cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  /** Register a plugin instance */
  register(plugin: IPlugin): void {
    if (this.plugins.has(plugin.name)) {
      console.warn(`[PluginManager] Plugin "${plugin.name}" already registered, skipping.`);
      return;
    }

    this.plugins.set(plugin.name, plugin);

    const isLine = this.isLineFormatter(plugin);
    const isLog = this.isLogFormatter(plugin);

    if (isLine && isLog) {
      console.warn(
        `[PluginManager] Plugin "${plugin.name}" matches both LineFormatter and LogFormatter. ` +
        'Consider adding __formatterType to disambiguate.',
      );
    }

    if (isLine) {
      this.lineFormatters.push(plugin as ILineFormatter);
    }

    if (isLog) {
      this.logFormatters.push(plugin as ILogFormatter);
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

  /** Get all registered LineFormatters sorted by priority */
  getLineFormatters(): ILineFormatter[] {
    return [...this.lineFormatters].sort((a, b) => a.priority - b.priority);
  }

  /** Get all registered LogFormatters sorted by priority */
  getLogFormatters(): ILogFormatter[] {
    return [...this.logFormatters].sort((a, b) => a.priority - b.priority);
  }

  private isLineFormatter(plugin: IPlugin): boolean {
    const p = plugin as ILineFormatter;
    // Explicit __formatterType takes priority
    if (p.__formatterType === 'line') return true;
    if (p.__formatterType === 'log') return false;
    // Auto-detect by method signature: ILineFormatter has formatLine()
    return 'formatLine' in plugin && typeof p.formatLine === 'function';
  }

  private isLogFormatter(plugin: IPlugin): boolean {
    const p = plugin as ILogFormatter;
    // Explicit __formatterType takes priority
    if (p.__formatterType === 'log') return true;
    if (p.__formatterType === 'line') return false;
    // Auto-detect by method signature: ILogFormatter has format()
    return 'format' in plugin && typeof p.format === 'function';
  }
}

/** Helper to resolve import path relative to cwd */
function resolveImportPath(cwd: string, importPath: string): string {
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return resolve(cwd, importPath);
  }
  return importPath;
}
