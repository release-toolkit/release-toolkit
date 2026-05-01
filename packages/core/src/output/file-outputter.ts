import { FileOutputterOptions } from '../types.js';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

export class FileOutputter {
  /** Write content to file system with specified mode */
  write(options: FileOutputterOptions): void {
    const { filePath, content, mode } = options;

    switch (mode) {
      case 'append':
        this.appendFile(filePath, content);
        break;

      case 'overwrite':
      default:
        this.writeFile(filePath, content);
        break;
    }

    console.log(`[FileOutputter] Wrote ${content.length} bytes to ${filePath} (${mode} mode)`);
  }

  private writeFile(filePath: string, content: string): void {
    writeFileSync(filePath, content, 'utf-8');
  }

  private appendFile(filePath: string, content: string): void {
    if (!existsSync(filePath)) {
      this.writeFile(filePath, content);
      return;
    }

    const existing = readFileSync(filePath, 'utf-8');
    const combined = existing + '\n' + content;
    writeFileSync(filePath, combined, 'utf-8');
  }
}
