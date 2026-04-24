import { ChangeLogEntry, ChangeLogOutput } from '../types.js';

export class ChangelogCollector {
  /** Merge multiple entry arrays, deduplicate by hash+subject, and sort */
  collect(sources: ChangeLogEntry[][]): ChangeLogEntry[] {
    const seen = new Map<string, ChangeLogEntry>();
    const result: ChangeLogEntry[] = [];

    for (const source of sources) {
      for (const entry of source) {
        // Create dedup key: hash + type + scope + subject
        const key = this.dedupKey(entry);
        if (!seen.has(key)) {
          seen.set(key, entry);
          result.push(entry);
        }
      }
    }

    return this.sortEntries(result);
  }

  private dedupKey(entry: ChangeLogEntry): string {
    return `${entry.hash || ''}|${entry.type}|${entry.scope || ''}|${entry.subject}`;
  }

  private sortEntries(entries: ChangeLogEntry[]): ChangeLogEntry[] {
    // Sort by commit type priority then by subject
    const typeOrder: Record<string, number> = {
      feat: 0,
      fix: 1,
      perf: 2,
      refactor: 3,
      docs: 4,
      build: 5,
      ci: 6,
      test: 7,
      style: 8,
      chore: 9,
      revert: 10,
    };

    return entries.sort((a, b) => {
      const orderA = typeOrder[a.type] ?? 99;
      const orderB = typeOrder[b.type] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.subject.localeCompare(b.subject);
    });
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
