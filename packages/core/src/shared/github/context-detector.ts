import type { GithubContext } from '../types.js';

export function detectGithubContext(): GithubContext {
  const isGitHubActions = process.env.GITHUB_ACTIONS === 'true';

  if (!isGitHubActions) {
    return {
      isGitHubActions: false,
      eventName: '',
    };
  }

  const context: GithubContext = {
    isGitHubActions: true,
    eventName: process.env.GITHUB_EVENT_NAME || '',
    token: process.env.GITHUB_TOKEN,
  };

  const repo = process.env.GITHUB_REPOSITORY;
  if (repo) {
    const [owner, name] = repo.split('/');
    context.repoOwner = owner;
    context.repoName = name;
  }

  const prNumberStr =
    process.env.PR_NUMBER || process.env.GITHUB_PR_NUMBER || '';
  if (prNumberStr) {
    context.prNumber = parseInt(prNumberStr, 10);
  }

  context.baseRef = process.env.GITHUB_BASE_REF;
  context.headRef = process.env.GITHUB_HEAD_REF;

  return context;
}
