import { ILogFormatter, ChangeLogOutput, ChangeLogEntry } from '@release-toolkit/core';
import { COMMIT_TYPE_CATEGORY } from '@release-toolkit/core';

/** Category display order for grouping */
const CATEGORY_ORDER: string[] = [
  'Features',
  'Bug Fixes',
  'Performance',
  'Refactoring',
  'Documentation',
  'Tests',
  'Build & CI',
  'Chores',
  'Reverts',
];

/** Get category name for a commit type */
function getCategoryName(type: string): string {
  return COMMIT_TYPE_CATEGORY[type]?.name || type;
}

export const categoryGroupPlugin: ILogFormatter = {
  name: 'category-group',
  priority: 10,

  format(changelog: ChangeLogOutput): ChangeLogOutput {
    const sorted = [...changelog.entries].sort((a, b) => {
      // First: sort by category order
      const catA = getCategoryName(a.type);
      const catB = getCategoryName(b.type);
      const orderA = CATEGORY_ORDER.indexOf(catA);
      const orderB = CATEGORY_ORDER.indexOf(catB);
      const catDiff = (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
      if (catDiff !== 0) return catDiff;

      // Second: sort by scope within same category
      if ((a.scope || '') !== (b.scope || '')) {
        return (a.scope || '').localeCompare(b.scope || '');
      }

      // Third: sort by subject
      return a.subject.localeCompare(b.subject);
    });

    return { ...changelog, entries: sorted };
  },
};
