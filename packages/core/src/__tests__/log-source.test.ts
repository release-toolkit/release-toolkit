import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseReleaseLogFromText } from '../features/pr-log-collector/log-source.js';
import { DEFAULT_CONFIG } from '../shared/config/index.js';

vi.mock('../shared/github/api-client.js', () => ({
  getPRComments: vi.fn(),
}));

import { getPRComments } from '../shared/github/api-client.js';
import { resolveReleaseLogText } from '../features/pr-log-collector/log-source.js';

describe('resolveReleaseLogText', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pr-body 模式直接返回 body', async () => {
    const body = '<!-- RELEASE-LOG-START -->\n## pkg\n- feat: x\n<!-- RELEASE-LOG-END -->';
    const text = await resolveReleaseLogText(
      body,
      {
        isGitHubActions: true,
        eventName: 'pull_request',
        prNumber: 1,
        repoOwner: 'o',
        repoName: 'r',
      },
      {
        ...DEFAULT_CONFIG,
        prLogCollector: {
          ...DEFAULT_CONFIG.prLogCollector,
          logExtraction: { source: 'pr-body' },
        },
      },
    );
    expect(text).toBe(body);
    expect(getPRComments).not.toHaveBeenCalled();
  });

  it('comment 模式从首条含标记的评论读取', async () => {
    vi.mocked(getPRComments).mockResolvedValue({
      data: [
        { id: 1, body: 'no markers', created_at: '2020-01-01T00:00:00Z' },
        {
          id: 2,
          body: '<!-- RELEASE-LOG-START -->\n## a\n- feat: from comment\n<!-- RELEASE-LOG-END -->',
          created_at: '2020-01-02T00:00:00Z',
        },
      ],
    } as never);

    const text = await resolveReleaseLogText(
      'empty body',
      {
        isGitHubActions: true,
        eventName: 'pull_request',
        prNumber: 1,
        repoOwner: 'o',
        repoName: 'r',
      },
      DEFAULT_CONFIG,
    );

    expect(text).toContain('from comment');
    const parsed = parseReleaseLogFromText(text, DEFAULT_CONFIG);
    expect(parsed.packageChangeLogs[0]?.changeLog).toContain('from comment');
  });
});
