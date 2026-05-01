import { ChangeLogEntry, ChangeLogOutput } from '../types.js';
import { PluginManager } from './plugin-manager.js';

/**
 * Two-stage pipeline engine:
 * Stage 1 (LineFormatter): Transform each entry individually. Return null to drop.
 * Stage 2 (LogFormatter): Post-process the entire document structure.
 */
export class Pipeline {
  private manager: PluginManager;

  constructor(manager: PluginManager) {
    this.manager = manager;
  }

  /**
   * Run the full pipeline on entries.
   *
   * @param entries - Raw changelog entries
   * @param version - Version string for output metadata
   * @returns Formatted ChangeLogOutput after all stages
   */
  async run(entries: ChangeLogEntry[], version: string): Promise<ChangeLogOutput> {
    // Stage 1: LineFormatters - transform each entry
    const currentEntries = await this.runLineStage(entries);

    // Create initial output from processed entries
    let output: ChangeLogOutput = {
      version,
      date: new Date().toISOString().split('T')[0],
      entries: currentEntries,
    };

    // Stage 2: LogFormatters - post-process entire structure
    output = await this.runLogStage(output);

    return output;
  }

  /** Run LineFormatter stage: each entry goes through all line formatters in priority order */
  private async runLineStage(entries: ChangeLogEntry[]): Promise<ChangeLogEntry[]> {
    const formatters = this.manager.getLineFormatters();

    if (formatters.length === 0) {
      return entries;
    }

    let result = [...entries];

    for (const formatter of formatters) {
      result = result.flatMap((entry) => {
        try {
          const formatted = formatter.format(entry);
          return formatted !== null ? [formatted] : [];
        } catch (error) {
          console.error(`[Pipeline] Error in LineFormatter "${formatter.name}":`, error);
          return [entry]; // Pass through unchanged on error
        }
      });
    }

    return result;
  }

  /** Run LogFormatter stage: entire output passes through all log formatters in priority order */
  private async runLogStage(output: ChangeLogOutput): Promise<ChangeLogOutput> {
    const formatters = this.manager.getLogFormatters();

    if (formatters.length === 0) {
      return output;
    }

    let result = output;

    for (const formatter of formatters) {
      try {
        result = formatter.format(result);
      } catch (error) {
        console.error(`[Pipeline] Error in LogFormatter "${formatter.name}":`, error);
      }
    }

    return result;
  }
}
