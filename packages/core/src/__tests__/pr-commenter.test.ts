import { describe, it, expect, vi, beforeEach } from 'vitest';
import { COMMENT_ANCHOR_START, wrapToolComment } from '@release-toolkit/markdown';

vi.mock('../shared/github/api-client.js', () => ({
  getPRComments: vi.fn(),
  updatePRComment: vi.fn(),
  createPRComment: vi.fn(),
}));

import { getPRComments, updatePRComment, createPRComment } from '../shared/github/api-client.js';
import { postOrUpdateComment } from '../shared/github/pr-commenter.js';

const ctx = {
  isGitHubActions: true,
  eventName: 'pull_request',
  prNumber: 1,
  repoOwner: 'o',
  repoName: 'r',
};

describe('postOrUpdateComment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('应更新含历史锚点的评论并迁移到新锚点', async () => {
    vi.mocked(getPRComments).mockResolvedValue({
      data: [
        {
          id: 99,
          body: '<!-- release-toolkit-report-start -->\n旧内容\n<!-- release-toolkit-report-end -->',
        },
      ],
    } as never);

    await postOrUpdateComment(ctx, '新内容');

    expect(updatePRComment).toHaveBeenCalledWith(
      ctx,
      99,
      wrapToolComment('新内容'),
    );
    expect(createPRComment).not.toHaveBeenCalled();
  });

  it('无已有评论时创建标准锚点评论', async () => {
    vi.mocked(getPRComments).mockResolvedValue({ data: [] } as never);

    await postOrUpdateComment(ctx, 'hello');

    expect(createPRComment).toHaveBeenCalledWith(ctx, wrapToolComment('hello'));
  });

  it('自定义 marker 时仅匹配自定义锚点', async () => {
    vi.mocked(getPRComments).mockResolvedValue({
      data: [{ id: 1, body: `${COMMENT_ANCHOR_START}\nold` }],
    } as never);

    await postOrUpdateComment(ctx, 'x', {
      markerStart: '<!-- custom-start -->',
      markerEnd: '<!-- custom-end -->',
    });

    expect(createPRComment).toHaveBeenCalledWith(
      ctx,
      '<!-- custom-start -->\nx\n<!-- custom-end -->',
    );
  });
});
