import { ChangeLogEntry, ChangeLogOutput } from '../../types.js';

export class ChangelogCollector {
  /** Merge multiple entry arrays and deduplicate by hash+type+scope+subject.
   *  Sorting is delegated to the category-group plugin. */
  collect(sources: ChangeLogEntry[][]): ChangeLogEntry[] {
    const seen = new Map<string, ChangeLogEntry>();
    const result: ChangeLogEntry[] = [];

    for (const source of sources) {
      for (const entry of source) {
        const key = this.dedupKey(entry);
        if (!seen.has(key)) {
          seen.set(key, entry);
          result.push(entry);
        }
      }
    }

    return result;
  }

  private dedupKey(entry: ChangeLogEntry): string {
    return `${entry.hash || ''}|${entry.type}|${entry.scope || ''}|${entry.subject}`;
  }

  /** Wrap entries into a ChangeLogOutput with metadata */
  createOutput(version: string, entries: ChangeLogEntry[]): ChangeLogOutput {
    return {
      version,
      date: new Date().toISOString().split('T')[0],
      entries,
    };
  }
}
