import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RELEASE_LOG_END, RELEASE_LOG_START } from '@release-toolkit/markdown';
import { resolveReleaseLogForPR } from '../log-resolve.js';
import type { PRContext } from '../format.js';
import type { GitHubClient } from '../github-client.js';

const prCtx: PRContext = {
  owner: 'org',
  repo: 'repo',
  prNumber: 1,
  prTitle: 'feat: test',
  prBody: null,
  baseRef: 'dev',
  headRef: 'feature',
  headSha: 'sha',
};

const MARKED = `${RELEASE_LOG_START}\n## pkg-a\n- custom log\n${RELEASE_LOG_END}`;

function mockClient(comments: Array<{ body?: string; created_at?: string }>): GitHubClient {
  return {
    getPullRequest: vi.fn(),
    listIssueComments: vi.fn().mockResolvedValue(comments),
    createIssueComment: vi.fn(),
    updateIssueComment: vi.fn(),
    updatePullRequest: vi.fn(),
    getRepoContent: vi.fn(),
    compareCommits: vi.fn(),
    createWorkflowDispatch: vi.fn(),
  };
}

describe('resolveReleaseLogForPR', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('comment 模式从评论解析 RELEASE-LOG', async () => {
    const client = mockClient([
      { body: MARKED, created_at: '2020-01-01T00:00:00Z' },
    ]);

    const result = await resolveReleaseLogForPR(client, prCtx, {
      prLogCollector: { logExtraction: { source: 'comment' } },
    });

    expect(result.rawReleaseLog).toContain('## pkg-a');
    expect(result.packageChangeLogs).toEqual([
      { packages: ['pkg-a'], changeLog: '- custom log' },
    ]);
  });

  it('pr-body 模式只读描述体', async () => {
    const client = mockClient([{ body: MARKED }]);
    const ctx = {
      ...prCtx,
      prBody: `${RELEASE_LOG_START}\n## body-pkg\n- in body\n${RELEASE_LOG_END}`,
    };

    const result = await resolveReleaseLogForPR(client, ctx, {
      prLogCollector: { logExtraction: { source: 'pr-body' } },
    });

    expect(result.packageChangeLogs[0]?.packages).toEqual(['body-pkg']);
    expect(client.listIssueComments).not.toHaveBeenCalled();
  });

  it('body 已有 RELEASE-LOG 时不拉评论', async () => {
    const client = mockClient([{ body: MARKED }]);
    const ctx = {
      ...prCtx,
      prBody: `${RELEASE_LOG_START}\n## in-body\n- skip api\n${RELEASE_LOG_END}`,
    };

    const result = await resolveReleaseLogForPR(client, ctx, {
      prLogCollector: { logExtraction: { source: 'comment' } },
    });

    expect(result.packageChangeLogs[0]?.packages).toEqual(['in-body']);
    expect(client.listIssueComments).not.toHaveBeenCalled();
  });
});
