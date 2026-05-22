import { describe, it, expect } from 'vitest';
import { formatReleasePreviewComment } from '../features/release-preview/formatter.js';

const diffs = [
  {
    package: {
      packageName: 'pkg-a',
      packagePath: '/p',
      currentVersion: '1.0.0',
      newVersion: '1.1.0',
    },
    diffType: 'minor' as const,
  },
];

describe('formatReleasePreviewComment previewOutput', () => {
  it('可关闭版本表格与变更日志', () => {
    const body = formatReleasePreviewComment(
      true,
      diffs,
      '### PR #1\n\nlog line',
      'no change',
      [],
      false,
      {
        showVersionDiff: false,
        showPackageList: true,
        showChangelog: false,
      },
    );

    expect(body).not.toContain('| 包名 |');
    expect(body).toContain('### 变更包');
    expect(body).not.toContain('### 变更日志');
  });
});
