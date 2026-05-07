/**
 * 插件类型定义
 */

export interface ChangelogFormatter {
  name: string;
  /**
   * 格式化整个 changelog 条目列表
   * @param entries changelog 条目数组
   * @returns 格式化后的 Markdown 字符串
   */
  format?: (entries: Array<{ type: string; scope?: string; subject: string }>) => string;

  /**
   * 格式化单行 changelog 条目
   * @param line 原始行内容
   * @returns 格式化后的行内容
   */
  formatLine?: (line: string) => string;
}

/** 加载后的插件集合 */
export interface LoadedPlugins {
  /** 格式化器数组 */
  formatters: ChangelogFormatter[];
}
