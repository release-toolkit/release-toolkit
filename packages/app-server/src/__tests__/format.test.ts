import { describe, it, expect } from 'vitest';
import {
  resolveOutputSections,
  outputSectionsFromRepoConfig,
  mergeOutputSections,
  DEFAULT_OUTPUT_SECTIONS,
  escapeRegex,
  applyEmojiPrefix,
  toBulletLines,
  formatTitleBullet,
  formatChangeLogBullets,
  parseReleaseLog,
  extractReleaseLog,
  renderVersionDiffTable,
  buildPreviewMarkdown,
  buildEditGuide,
  buildPRComment,
  buildConfirmedReleaseLog,
  upsertOutputInBody,
  wrapOutputMarkers,
  OUTPUT_START,
  OUTPUT_END,
  RELEASE_LOG_START,
  RELEASE_LOG_END,
  type PRContext,
  type VersionDiff,
} from '../format.js';

const samplePRCtx: PRContext = {
  owner: 'my-org',
  repo: 'my-repo',
  prNumber: 123,
  prTitle: 'feat: 新增登录功能',
  prBody: null,
  baseRef: 'dev',
  headRef: 'feature-login',
  headSha: 'abc',
};

describe('outputSectionsFromRepoConfig', () => {
  it('应从 config.json 结构解析 outputSections', () => {
    expect(
      outputSectionsFromRepoConfig({
        prLogCollector: {
          outputSections: { notification: false, preview: true, editGuide: false },
        },
      }),
    ).toEqual({ notification: false, preview: true, editGuide: false });
  });

  it('无 prLogCollector 时返回 null', () => {
    expect(outputSectionsFromRepoConfig({})).toBeNull();
  });
});

describe('mergeOutputSections', () => {
  it('应合并部分字段', () => {
    expect(mergeOutputSections({ notification: false })).toEqual({
      notification: false,
      preview: true,
      editGuide: true,
    });
  });
});

describe('resolveOutputSections', () => {
  it('应返回默认值当未提供 raw JSON 时', () => {
    expect(resolveOutputSections()).toEqual(DEFAULT_OUTPUT_SECTIONS);
  });

  it('应解析合法的 JSON 字符串', () => {
    expect(
      resolveOutputSections('{"notification":false,"preview":true,"editGuide":false}'),
    ).toEqual({ notification: false, preview: true, editGuide: false });
  });

  it('应在解析失败时回退到默认值', () => {
    expect(resolveOutputSections('{not valid')).toEqual(DEFAULT_OUTPUT_SECTIONS);
  });

  it('应保留未设置的字段为默认值', () => {
    expect(resolveOutputSections('{"notification":false}')).toEqual({
      notification: false,
      preview: true,
      editGuide: true,
    });
  });
});

describe('escapeRegex', () => {
  it('应转义所有正则元字符', () => {
    expect(escapeRegex('a.b*c?d')).toBe('a\\.b\\*c\\?d');
  });
});

describe('applyEmojiPrefix', () => {
  it('对 conventional commit 行加 emoji', () => {
    expect(applyEmojiPrefix('- feat: 新增登录')).toBe('- ✨ feat: 新增登录');
    expect(applyEmojiPrefix('- fix(auth): 修复登录')).toBe('- 🐛 fix(auth): 修复登录');
  });

  it('未知 type 时返回原文', () => {
    expect(applyEmojiPrefix('- unknown: x')).toBe('- unknown: x');
    expect(applyEmojiPrefix('- 普通文本')).toBe('- 普通文本');
  });

  it('已含 emoji 不重复添加', () => {
    expect(applyEmojiPrefix('- ✨ feat: 新功能')).toBe('- ✨ feat: 新功能');
  });
});

describe('toBulletLines', () => {
  it('给纯文本行加 `- ` 前缀', () => {
    expect(toBulletLines('行一\n行二')).toEqual(['- 行一', '- 行二']);
  });

  it('已以 `-` 开头的行不重复添加前缀', () => {
    expect(toBulletLines('- 已有\n普通')).toEqual(['- 已有', '- 普通']);
  });

  it('忽略空行', () => {
    expect(toBulletLines('\n\n行\n')).toEqual(['- 行']);
  });
});

describe('formatTitleBullet', () => {
  it('生成 `- {title}（标题）`，并走 emoji 前缀', () => {
    expect(formatTitleBullet('feat: 新增登录')).toBe('- ✨ feat: 新增登录（标题）');
    expect(formatTitleBullet('chore: 杂项')).toBe('- 🔧 chore: 杂项（标题）');
  });
});

describe('formatChangeLogBullets', () => {
  it('空内容返回占位文本', () => {
    expect(formatChangeLogBullets('')).toEqual(['- （无对应的变更日志）']);
    expect(formatChangeLogBullets('  \n  ')).toEqual(['- （无对应的变更日志）']);
  });

  it('普通文本转为 bullet 列表', () => {
    expect(formatChangeLogBullets('新增微信登录\n修复定时器')).toEqual([
      '- 新增微信登录',
      '- 修复定时器',
    ]);
  });

  it('conventional commit 行加 emoji', () => {
    expect(formatChangeLogBullets('feat: A\nfix: B')).toEqual([
      '- ✨ feat: A',
      '- 🐛 fix: B',
    ]);
  });
});

describe('parseReleaseLog', () => {
  it('单个包 + 直接列表', () => {
    const result = parseReleaseLog('## package-a\n- feat: A\n- fix: B');
    expect(result).toEqual([{ packages: ['package-a'], changeLog: '- feat: A\n- fix: B' }]);
  });

  it('多个包共享日志（逗号分隔）', () => {
    const result = parseReleaseLog('## pkg-a, pkg-b\n- 共同变更');
    expect(result).toEqual([{ packages: ['pkg-a', 'pkg-b'], changeLog: '- 共同变更' }]);
  });

  it('多包章节独立解析', () => {
    const result = parseReleaseLog('## a\n- A\n\n## b\n- B');
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ packages: ['a'], changeLog: '- A' });
    expect(result[1]).toEqual({ packages: ['b'], changeLog: '- B' });
  });

  it('兼容旧格式 `### 标题/变更日志` 子标题被跳过', () => {
    const result = parseReleaseLog('## pkg\n### 标题\n这一行被收集\n### 变更日志\n- 列表');
    expect(result).toHaveLength(1);
    expect(result[0].changeLog).toContain('这一行被收集');
    expect(result[0].changeLog).toContain('- 列表');
  });

  it('无包名时作为通用变更日志', () => {
    const result = parseReleaseLog('- 通用 1\n- 通用 2');
    expect(result).toEqual([{ packages: [], changeLog: '- 通用 1\n- 通用 2' }]);
  });

  it('空内容返回空数组', () => {
    expect(parseReleaseLog('')).toEqual([]);
    expect(parseReleaseLog('   ')).toEqual([]);
  });
});

describe('extractReleaseLog', () => {
  it('body 为空返回 null', () => {
    expect(extractReleaseLog(null)).toEqual({ rawReleaseLog: null, packageChangeLogs: [] });
    expect(extractReleaseLog('')).toEqual({ rawReleaseLog: null, packageChangeLogs: [] });
  });

  it('提取标记区内容并解析', () => {
    const body = `前言\n${RELEASE_LOG_START}\n## pkg\n- 新内容\n${RELEASE_LOG_END}\n后语`;
    const result = extractReleaseLog(body);
    expect(result.rawReleaseLog).toContain('## pkg');
    expect(result.packageChangeLogs).toEqual([{ packages: ['pkg'], changeLog: '- 新内容' }]);
  });

  it('标记区缺失或顺序错乱时返回 null', () => {
    expect(extractReleaseLog('no markers').rawReleaseLog).toBeNull();
    const reversed = `${RELEASE_LOG_END}\nx\n${RELEASE_LOG_START}`;
    expect(extractReleaseLog(reversed).rawReleaseLog).toBeNull();
  });
});

describe('renderVersionDiffTable', () => {
  it('空数组返回占位', () => {
    expect(renderVersionDiffTable([])).toContain('（无版本变更）');
  });

  it('生成 markdown 表格', () => {
    const diffs: VersionDiff[] = [{ packageName: 'a', currentVersion: '1.0.0', newVersion: '1.1.0' }];
    const table = renderVersionDiffTable(diffs);
    expect(table).toContain('| 包名 | 当前版本 | 新版本 |');
    expect(table).toContain('| `a` | 1.0.0 | 1.1.0 |');
  });
});

describe('buildPreviewMarkdown', () => {
  it('包含 PR 编号、变更包列表、每包章节', () => {
    const md = buildPreviewMarkdown(samplePRCtx, ['package-a'], [], [
      { packages: ['package-a'], changeLog: '- 内容' },
    ]);
    expect(md).toContain('# PR #123 变更日志');
    expect(md).toContain('## 变更包列表：');
    expect(md).toContain('## package-a');
    expect(md).toContain('- ✨ feat: 新增登录功能（标题）');
    expect(md).toContain('- 内容');
  });

  it('无变更包时输出 (无变更包)', () => {
    const md = buildPreviewMarkdown(samplePRCtx, [], [], []);
    expect(md).toContain('（无变更包）');
    expect(md).toContain('## 变更内容');
  });
});

describe('buildPRComment', () => {
  it('全部 sections 开启时输出三段', () => {
    const comment = buildPRComment({
      prCtx: samplePRCtx,
      changedPackages: ['pkg'],
      versionDiffs: [{ packageName: 'pkg', currentVersion: '1.0.0', newVersion: '1.1.0' }],
      parsedLogs: [],
      sections: { notification: true, preview: true, editGuide: true },
    });
    expect(comment).toContain('📢 **PR 待审批**');
    expect(comment).toContain('| 包名 | 当前版本 | 新版本 |');
    expect(comment).toContain('# PR #123 变更日志');
    expect(comment).toContain('如何修改变更日志');
  });

  it('approved=true 时显示「已批准」', () => {
    const comment = buildPRComment({
      prCtx: samplePRCtx,
      changedPackages: [],
      versionDiffs: [],
      parsedLogs: [],
      sections: { notification: true, preview: false, editGuide: false },
      approved: true,
    });
    expect(comment).toContain('✅ **PR 已批准**');
  });

  it('全部 sections 关闭时返回占位文本', () => {
    const comment = buildPRComment({
      prCtx: samplePRCtx,
      changedPackages: [],
      versionDiffs: [],
      parsedLogs: [],
      sections: { notification: false, preview: false, editGuide: false },
    });
    expect(comment).toContain('所有输出区块均已关闭');
  });
});

describe('upsertOutputInBody', () => {
  it('首次添加追加到末尾', () => {
    const result = upsertOutputInBody('原描述', 'CONTENT');
    expect(result).toContain('原描述');
    expect(result).toContain(`${OUTPUT_START}\nCONTENT\n${OUTPUT_END}`);
  });

  it('已有标记区时幂等替换', () => {
    const body = `前\n${OUTPUT_START}\nOLD\n${OUTPUT_END}\n后`;
    const result = upsertOutputInBody(body, 'NEW');
    expect(result).toContain(`${OUTPUT_START}\nNEW\n${OUTPUT_END}`);
    expect(result).not.toContain('OLD');
    expect(result).toContain('前');
    expect(result).toContain('后');
  });

  it('null body 时仅写标记区', () => {
    const result = upsertOutputInBody(null, 'X');
    expect(result).toBe(`${OUTPUT_START}\nX\n${OUTPUT_END}`);
  });
});

describe('wrapOutputMarkers / buildEditGuide / buildConfirmedReleaseLog', () => {
  it('wrapOutputMarkers 包裹标记', () => {
    expect(wrapOutputMarkers('X')).toBe(`${OUTPUT_START}\nX\n${OUTPUT_END}`);
  });

  it('buildEditGuide 含 `<details>` 折叠块与评论说明', () => {
    const guide = buildEditGuide();
    expect(guide).toContain('<details>');
    expect(guide).toContain(RELEASE_LOG_START);
    expect(guide).toContain(RELEASE_LOG_END);
    expect(guide).toContain('PR 评论');
  });

  it('buildConfirmedReleaseLog 含已确认横幅与预览', () => {
    const log = buildConfirmedReleaseLog(samplePRCtx, ['pkg'], [], []);
    expect(log).toContain('PR #123 变更日志（已确认）');
    expect(log).toContain('已通过 Review 确认');
    expect(log).toContain('## pkg');
  });
});
