import { ChangeLogOutput, ChangeLogEntry } from '../../types.js';

export interface RendererOptions {
  /** GitHub repository URL for PR links, e.g. https://github.com/owner/repo */
  repoUrl?: string;
}

/**
 * Basic changelog renderer — only outputs structural Markdown.
 * All formatting (emoji, category grouping, bold) is handled by plugins.
 */
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

    // Render each entry as a flat list (formatting is handled by plugins)
    for (const entry of output.entries) {
      lines.push(this.renderEntryLine(entry, opts));
    }
    lines.push('');

    return lines.join('\n').replace(/\n+$/, '\n');
  }

  private renderEntryLine(entry: ChangeLogEntry, opts: RendererOptions): string {
    let line = '- ';

    // Scope (plain, plugins handle formatting)
    if (entry.scope) {
      line += `${entry.scope}: `;
    }

    // Subject (as-is, plugins may have transformed it)
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
