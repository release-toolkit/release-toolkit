import { ILineFormatter, ChangeLogEntry } from '@release-toolkit/core';

export const markdownBoldPlugin: ILineFormatter = {
  name: 'markdown-bold',
  priority: 15,
  __formatterType: 'line',

  format(entry: ChangeLogEntry): ChangeLogEntry | null {
    if (!entry.scope) {
      return entry;
    }

    // Check if scope is already bolded
    if (/\*\*[^*]+\*\*/.test(entry.subject)) {
      return entry;
    }

    // Add bold to scope in subject: "feat(auth): ..." → "feat(**auth**): ..."
    const result = entry.subject.replace(
      /^(\w+)\(([^)]+)\):?/,
      (_, type, scope) => `${type}(**${scope}**):`,
    );

    return {
      ...entry,
      subject: result,
    };
  },
};
