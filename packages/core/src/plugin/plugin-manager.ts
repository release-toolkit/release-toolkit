import {
  IPlugin,
  ILineFormatter,
  ILogFormatter,
  ChangeLogEntry,
  ChangeLogOutput,
  PluginContext,
} from '../types.js';
import { resolve } from 'node:path';

export class PluginManager {
  private lineFormatters: ILineFormatter[] = [];
  private logFormatters: ILogFormatter[] = [];
  private plugins: Map<string, IPlugin> = new Map();
  private context: PluginContext;

  constructor(context: PluginContext) {
    this.context = context;
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
          ? resolveImportPath(this.context.cwd, name)
          : `@release-toolkit/changelog-presets/dist/formatters/${name}.js`
      );

      const pluginFactory = module.default || module;
      const plugin =
        typeof pluginFactory === 'function'
          ? await pluginFactory(this.context.options)
          : pluginFactory;

      if (plugin && typeof plugin.name === 'string') {
        this.register(plugin);
        console.log(`[PluginManager] Loaded plugin: ${plugin.name}`);
      }
    } catch (error) {
      console.error(`[PluginManager] Failed to load plugin "${name}":`, error);
    }
  }

  /** Initialize all registered plugins */
  async initAll(): Promise<void> {
    for (const [, plugin] of this.plugins) {
      if (typeof plugin.init === 'function') {
        await plugin.init(this.context);
      }
    }
  }

  /** Get sorted line formatters by priority (ascending) */
  getLineFormatters(): ILineFormatter[] {
    return [...this.lineFormatters].sort((a, b) => a.priority - b.priority);
  }

  /** Get sorted log formatters by priority (ascending) */
  getLogFormatters(): ILogFormatter[] {
    return [...this.logFormatters].sort((a, b) => a.priority - b.priority);
  }

  /** Check if a plugin with given name is registered */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  getRegisteredNames(): string[] {
    return Array.from(this.plugins.keys());
  }

  private isLineFormatter(plugin: IPlugin): plugin is ILineFormatter {
    return 'format' in plugin && typeof (plugin as ILineFormatter).format === 'function';
  }

  private isLogFormatter(plugin: IPlugin): plugin is ILogFormatter {
    return 'format' in plugin && typeof (plugin as ILogFormatter).format === 'function';
  }
}

/** Helper to resolve import path relative to cwd */
function resolveImportPath(cwd: string, importPath: string): string {
  if (importPath.startsWith('.') || importPath.startsWith('/')) {
    return resolve(cwd, importPath);
  }
  return importPath;
}
