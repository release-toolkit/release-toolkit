import { simpleGit, type SimpleGit } from 'simple-git';

let _git: SimpleGit | null = null;

function getGit(cwd?: string): SimpleGit {
  if (!_git) {
    _git = simpleGit({ baseDir: cwd || process.cwd() });
  }
  return _git;
}

export async function diffFiles(
  baseRef: string,
  headRef: string,
  cwd?: string,
): Promise<string[]> {
  const git = getGit(cwd);
  const result = await git.diff(['--name-only', `${baseRef}...${headRef}`]);
  return result.split('\n').filter(Boolean);
}

export async function showFileContent(
  ref: string,
  filePath: string,
  cwd?: string,
): Promise<string> {
  const git = getGit(cwd);
  const result = await git.show([`${ref}:${filePath}`]);
  return result;
}

export async function getCurrentSha(cwd?: string): Promise<string> {
  const git = getGit(cwd);
  const result = await git.revparse(['HEAD']);
  return result.trim();
}

export async function createTag(
  tagName: string,
  message: string,
  cwd?: string,
): Promise<void> {
  const git = getGit(cwd);
  await git.tag(['-a', tagName, '-m', message]);
}

export async function pushTags(cwd?: string): Promise<void> {
  const git = getGit(cwd);
  await git.pushTags();
}
