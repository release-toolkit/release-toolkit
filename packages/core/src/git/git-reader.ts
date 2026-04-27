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

  /** Create a git tag */
  async tag(tagName: string, message?: string): Promise<void> {
    try {
      if (message) {
        await this.git.tag(['-a', tagName, '-m', message]);
      } else {
        await this.git.addTag(tagName);
      }
    } catch (error) {
      console.error(`[GitReader] Failed to create tag ${tagName}:`, error);
      throw error; // Re-throw so caller can decide whether to continue
    }
  }

  /** Push tags to remote */
  async pushTags(remote?: string): Promise<void> {
    try {
      const remoteName = remote || 'origin';
      await this.git.push([remoteName, '--tags']);
    } catch (error) {
      console.error(`[GitReader] Failed to push tags:`, error);
      throw error;
    }
  }

  /** Get the origin remote URL (e.g. git@github.com:owner/repo.git or https://...) */
  async getRemoteUrl(remote?: string): Promise<string> {
    try {
      const remoteName = remote || 'origin';
      const url = await this.git.remote(['get-url', remoteName]);
      return url?.trim() || '';
    } catch {
      return '';
    }
  }

}


