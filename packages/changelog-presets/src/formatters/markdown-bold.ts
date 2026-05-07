import type { ILineFormatter } from '@release-toolkit/core';

/**
 * Markdown bold formatter
 * Makes scope in conventional commits bold
 */
export const markdownBold: ILineFormatter = {
  name: 'markdown-bold',
  formatLine: (line: string) => {
    // Match scope in conventional commit: type(scope): message -> type(**scope**): message
    return line.replace(/^(\w+)\(([^)]+)\):/, '$1(**$2**):');
  },
};
