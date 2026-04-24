import { ChangeLogOutput, ChangeLogEntry } from '../types.js';
import { COMMIT_TYPE_CATEGORY, COMMIT_TYPE_EMOJI } from '../constants.js';

/** Category grouping result */
interface CategoryGroup {
  name: string;
  emoji: string;
  entries: ChangeLogEntry[];
}

export interface RendererOptions {
  /** GitHub repository URL for PR links, e.g. https://github.com/owner/repo */
  repoUrl?: string;
}

export class ChangelogRenderer {
  private options: RendererOptions;

  constructor(options: RendererOptions = {}) {
    this.options = options;
  }

  /** Render changelog output as Markdown string */
  renderMarkdown(output: ChangeLogOutput, options?: RendererOptions): string {
    const opts = { ...this.options, ...options };
    const lines: string[] = [];

    // Header
    lines.push(`## ${output.version} (${output.date})`);
    lines.push('');

    if (output.entries.length === 0) {
      lines.push('No changes.');
      lines.push('');
      return lines.join('\n');
    }

    // Group by category
    const grouped = this.groupByCategory(output.entries);

    for (const category of grouped) {
      const title = `${category.emoji} **${category.name}**`;
      lines.push(`### ${title}`);
      lines.push('');

      for (const entry of category.entries) {
        const line = this.renderEntryLine(entry, opts);
        lines.push(line);
      }
      lines.push('');
    }

    return lines.join('\n').replace(/\n+$/, '\n');
  }

  /** Render changelog output as JSON string */
  renderJson(output: ChangeLogOutput, pretty: boolean = true): string {
    return pretty ? JSON.stringify(output, null, 2) : JSON.stringify(output);
  }

  /** Group entries by category (multiple commit types can map to same category) */
  private groupByCategory(entries: ChangeLogEntry[]): CategoryGroup[] {
    const categoryMap = new Map<string, CategoryGroup>();

    for (const entry of entries) {
      const categoryInfo = COMMIT_TYPE_CATEGORY[entry.type] || {
        name: entry.type,
        emoji: COMMIT_TYPE_EMOJI[entry.type] || '📌',
      };

      if (!categoryMap.has(categoryInfo.name)) {
        categoryMap.set(categoryInfo.name, {
          name: categoryInfo.name,
          emoji: categoryInfo.emoji,
          entries: [],
        });
      }

      categoryMap.get(categoryInfo.name)!.entries.push(entry);
    }

    // Sort categories in logical order
    const categoryOrder = [
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

    return Array.from(categoryMap.values()).sort((a, b) => {
      const orderA = categoryOrder.indexOf(a.name);
      const orderB = categoryOrder.indexOf(b.name);
      return (orderA === -1 ? 999 : orderA) - (orderB === -1 ? 999 : orderB);
    });
  }

  private renderEntryLine(entry: ChangeLogEntry, opts: RendererOptions): string {
    let line = '- ';

    // Add emoji prefix if not already present
    const emoji = COMMIT_TYPE_EMOJI[entry.type] || '';
    if (emoji && !entry.subject.startsWith(emoji)) {
      line += `${emoji} `;
    }

    // Scope
    if (entry.scope) {
      line += `**${entry.scope}**: `;
    }

    // Subject
    line += entry.subject;

    // PR reference (as markdown link if repoUrl is provided)
    if (entry.prNumber) {
      if (opts.repoUrl) {
        line += ` ([#${entry.prNumber}](${opts.repoUrl}/pull/${entry.prNumber}))`;
      } else {
        line += ` (#${entry.prNumber})`;
      }
    }

    // Hash
    if (entry.hash) {
      line += ` (\`${entry.hash}\`)`;
    }

    // Extra note
    if (entry.extraNote) {
      line += ` - ${entry.extraNote}`;
    }

    return line;
  }
}
