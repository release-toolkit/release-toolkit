import { describe, it, expect } from 'vitest';
import {
  resolveReleaseLogTextFromComments,
  logExtractionConfigFromRepo,
  needsCommentListForExtraction,
} from '../shared/log-extraction.js';
import {
  COMMENT_ANCHOR_START,
  RELEASE_LOG_END,
  RELEASE_LOG_START,
} from '@release-toolkit/markdown';

const MARKED = `${RELEASE_LOG_START}\n## pkg\n- from comment\n${RELEASE_LOG_END}`;
const TOOL_COMMENT = `${COMMENT_ANCHOR_START}\n工具预览\n<!-- release-toolkit-comment-end -->`;

describe('needsCommentListForExtraction', () => {
  it('body 已有 RELEASE-LOG 时无需拉评论', () => {
    const body = `${RELEASE_LOG_START}\nx\n${RELEASE_LOG_END}`;
    expect(needsCommentListForExtraction(body, { logExtraction: { source: 'comment' } })).toBe(
      false,
    );
  });

  it('pr-body 模式无需拉评论', () => {
    expect(needsCommentListForExtraction('x', { logExtraction: { source: 'pr-body' } })).toBe(
      false,
    );
  });

  it('comment 模式且 body 无标记时需要拉评论', () => {
    expect(needsCommentListForExtraction('plain', { logExtraction: { source: 'comment' } })).toBe(
      true,
    );
  });
});

describe('resolveReleaseLogTextFromComments', () => {
  it('pr-body 模式直接返回 body', () => {
    const body = `${RELEASE_LOG_START}\n## pkg\n- x\n${RELEASE_LOG_END}`;
    expect(
      resolveReleaseLogTextFromComments(body, [{ body: MARKED }], {
        logExtraction: { source: 'pr-body' },
      }),
    ).toBe(body);
  });

  it('comment 模式从首条含标记的评论读取', () => {
    const text = resolveReleaseLogTextFromComments(
      'empty body',
      [
        { body: 'no markers', created_at: '2020-01-01T00:00:00Z' },
        { body: MARKED, created_at: '2020-01-02T00:00:00Z' },
      ],
      { logExtraction: { source: 'comment', commentPosition: 'first' } },
    );
    expect(text).toContain('from comment');
  });

  it('body 已有标记时优先使用 body', () => {
    const body = `${RELEASE_LOG_START}\n## body\n- in body\n${RELEASE_LOG_END}`;
    const text = resolveReleaseLogTextFromComments(
      body,
      [{ body: MARKED }],
      { logExtraction: { source: 'comment' } },
    );
    expect(text).toBe(body);
  });

  it('无标记时回退 body', () => {
    expect(
      resolveReleaseLogTextFromComments('fallback', [], { logExtraction: { source: 'comment' } }),
    ).toBe('fallback');
  });

  it('默认 source 为 comment', () => {
    const text = resolveReleaseLogTextFromComments('empty', [{ body: MARKED }], {});
    expect(text).toContain('from comment');
  });

  it('跳过工具自身评论', () => {
    const userMarked = `${RELEASE_LOG_START}\n## user\n- user log\n${RELEASE_LOG_END}`;
    const text = resolveReleaseLogTextFromComments(
      'empty',
      [
        { body: TOOL_COMMENT, created_at: '2020-01-01T00:00:00Z' },
        { body: userMarked, created_at: '2020-01-02T00:00:00Z' },
      ],
      { logExtraction: { source: 'comment' } },
    );
    expect(text).toContain('user log');
  });

  it('识别历史 report 锚点为工具评论并跳过', () => {
    const legacyTool = '<!-- release-toolkit-report-start -->\nold preview';
    const userMarked = `${RELEASE_LOG_START}\n- ok\n${RELEASE_LOG_END}`;
    const text = resolveReleaseLogTextFromComments(
      null,
      [
        { body: legacyTool, created_at: '2020-01-01T00:00:00Z' },
        { body: userMarked, created_at: '2020-01-02T00:00:00Z' },
      ],
      {},
    );
    expect(text).toContain('- ok');
  });
});

describe('logExtractionConfigFromRepo', () => {
  it('解析 prLogCollector 段', () => {
    expect(
      logExtractionConfigFromRepo({
        prLogCollector: {
          logExtraction: { source: 'pr-body' },
          releaseLogMarker: { start: '<!-- A -->', end: '<!-- B -->' },
        },
      }),
    ).toEqual({
      logExtraction: { source: 'pr-body' },
      releaseLogMarker: { start: '<!-- A -->', end: '<!-- B -->' },
    });
  });

  it('无效 config 返回空对象', () => {
    expect(logExtractionConfigFromRepo(null)).toEqual({});
  });
});
