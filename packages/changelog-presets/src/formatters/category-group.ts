import type { ILogFormatter } from '@release-toolkit/core';
import { COMMIT_TYPE_CATEGORY } from '../constants.js';

/**
 * Category group formatter
 * Groups changelog entries by commit type category
 */
export const categoryGroup: ILogFormatter = {
  name: 'category-group',
  format: (entries: Array<{ type: string; scope?: string; subject: string }>) => {
    const grouped = new Map<string, typeof entries>();

    // Group entries by category
    for (const entry of entries) {
      const category = COMMIT_TYPE_CATEGORY[entry.type];
      const categoryName = category ? category.name : 'Other';

      if (!grouped.has(categoryName)) {
        grouped.set(categoryName, []);
      }
      grouped.get(categoryName)!.push(entry);
    }

    // Format output
    const lines: string[] = [];
    for (const [category, items] of grouped) {
      const emoji = COMMIT_TYPE_CATEGORY[items[0]?.type];
      lines.push(`### ${emoji ? emoji.emoji + ' ' : ''}${category}`);
      lines.push('');
      for (const item of items) {
        const scope = item.scope ? `**${item.scope}**: ` : '';
        lines.push(`- ${scope}${item.subject}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  },
};
