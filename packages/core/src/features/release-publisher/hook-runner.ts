import { execSync } from 'node:child_process';
import type { ReleaseHookContext } from './types.js';

export function runAfterReleaseHooks(
  commands: string[],
  context: ReleaseHookContext,
  cwd?: string,
): Array<{ command: string; success: boolean; output?: string; error?: string }> {
  const results: Array<{
    command: string;
    success: boolean;
    output?: string;
    error?: string;
  }> = [];

  for (const cmd of commands) {
    try {
      const output = execSync(cmd, {
        cwd: cwd || process.cwd(),
        env: {
          ...process.env,
          RELEASE_PACKAGE_NAME: context.packageName,
          RELEASE_OLD_VERSION: context.oldVersion,
          RELEASE_NEW_VERSION: context.newVersion,
          RELEASE_TAG_NAME: context.tagName,
        },
        encoding: 'utf-8',
      });
      results.push({ command: cmd, success: true, output: output.trim() });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ command: cmd, success: false, error });
    }
  }

  return results;
}
