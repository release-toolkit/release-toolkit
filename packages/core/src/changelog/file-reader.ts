import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { ChangeLogEntry } from '../types.js';

export class ChangelogFileReader {
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
  }

  /**
   * Read all JSON files from a directory and parse them as ChangeLogEntry arrays.
   * Each file should contain a valid JSON array of ChangeLogEntry objects.
   *
   * @param dirPath - Directory containing changelog JSON files
   * @returns Merged array of ChangeLogEntry from all files
   */
  async readFromDirectory(dirPath: string): Promise<ChangeLogEntry[]> {
    const absoluteDir = resolve(this.baseDir, dirPath);

    try {
      const files = readdirSync(absoluteDir);
      const jsonFiles = files.filter((f) => extname(f).toLowerCase() === '.json');

      const allEntries: ChangeLogEntry[] = [];

      for (const file of jsonFiles) {
        const filePath = resolve(absoluteDir, file);
        const stat = statSync(filePath);

        if (!stat.isFile()) continue;

        const entries = this.readJsonFile(filePath);
        allEntries.push(...entries);
      }

      console.log(
        `[ChangelogFileReader] Read ${allEntries.length} entries from ${jsonFiles.length} files in ${dirPath}`,
      );

      return allEntries;
    } catch (error) {
      console.error(`[ChangelogFileReader] Error reading directory ${dirPath}:`, error);
      return [];
    }
  }

  /**
   * Read a single JSON file and parse as ChangeLogEntry array.
   *
   * @param filePath - Path to the JSON file
   * @returns Parsed ChangeLogEntry array
   */
  async readFile(filePath: string): Promise<ChangeLogEntry[]> {
    const absolutePath = resolve(this.baseDir, filePath);

    try {
      return this.readJsonFile(absolutePath);
    } catch (error) {
      console.error(`[ChangelogFileReader] Error reading file ${filePath}:`, error);
      return [];
    }
  }

  private readJsonFile(filePath: string): ChangeLogEntry[] {
    const content = readFileSync(filePath, 'utf-8');

    if (!content.trim()) {
      return [];
    }

    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed)) {
      console.warn(`[ChangelogFileReader] File ${filePath} does not contain an array, skipping`);
      return [];
    }

    // Validate each entry has at least `type` and `subject`
    return parsed.filter(
      (item): item is ChangeLogEntry =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.type === 'string' &&
        typeof item.subject === 'string',
    );
  }
}
