import simpleGit, { SimpleGit } from 'simple-git';

export class GitReader {
  private git: SimpleGit;
  private baseDir: string;

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = baseDir;
    this.git = simpleGit(baseDir);
  }

  /** Get list of files changed between base and head matching the given pattern */
  async diffFiles(baseRef: string, headRef?: string, pattern?: string[]): Promise<string[]> {
    const range = headRef ? `${baseRef}...${headRef}` : `${baseRef}...HEAD`;
    const args = ['--name-only', '--diff-filter=AMDR'];

    if (pattern && pattern.length > 0) {
      args.push('--', ...pattern);
    }

    try {
      const result = await this.git.diff([range, ...args]);
      return result
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .sort();
    } catch (error) {
      console.error(`[GitReader] diffFiles failed for range ${range}:`, error);
      return [];
    }
  }

  /** Get raw file content from a specific git ref (branch/commit) */
  async showFileContent(ref: string, filePath: string): Promise<string> {
    try {
      const result = await this.git.show(`${ref}:${filePath}`);
      return result || '';
    } catch (error) {
      console.error(`[GitReader] showFileContent failed for ${ref}:${filePath}:`, error);
      return '';
    }
  }

  /** Get current HEAD SHA */
  async getCurrentSha(): Promise<string> {
    try {
      return await this.git.revparse(['HEAD']);
    } catch (error) {
      console.error('[GitReader] getCurrentSha failed:', error);
      return '';
    }
  }

  /** Check if a branch/ref exists */
  async refExists(ref: string): Promise<boolean> {
    try {
      await this.git.revparse(['--verify', ref]);
      return true;
    } catch {
      return false;
    }
  }

  /** Create a git tag */
  async tag(tagName: string, message?: string): Promise<void> {
    if (message) {
      await this.git.tag(['-a', tagName, '-m', message]);
    } else {
      await this.git.addTag(tagName);
    }
  }

  /** Push tags to remote */
  async pushTags(remote?: string): Promise<void> {
    const remoteName = remote || 'origin';
    await this.git.push([remoteName, '--tags']);
  }

  /** Push commits to remote */
  async push(remote?: string, branch?: string): Promise<void> {
    const remoteName = remote || 'origin';
    const args = [remoteName];
    if (branch) {
      args.push(branch);
    }
    await this.git.push(args);
  }

  /** Get git log entries between two refs */
  async log(from: string, to: string): Promise<{ hash: string; message: string }[]> {
    try {
      const logResult = await this.git.log({ from, to, '--no-merge': null });
      return logResult.all.map((commit) => ({
        hash: commit.hash,
        message: commit.message,
      }));
    } catch (error) {
      console.error('[GitReader] log failed:', error);
      return [];
    }
  }

  getBaseDir(): string {
    return this.baseDir;
  }
}
