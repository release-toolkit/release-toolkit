import { describe, it, expect, expectTypeOf } from 'vitest';
import type {
  DiffType,
  PackageVersionInfo,
  VersionDiffResult,
  GithubContext,
  ChangelogEntry,
  ChangelogFormatter,
  ILineFormatter,
  ILogFormatter,
  ILogParser,
  IPlugin,
  LoadedPlugins,
  LoadPluginsResult,
  ReleaseHookContext,
  PRLogCollectorResult,
  ReleasePreviewResult,
  ReleasePublisherResult,
} from '../index.js';

describe('DiffType', () => {
  it('允许 major/minor/patch/null', () => {
    const a: DiffType = 'major';
    const b: DiffType = 'minor';
    const c: DiffType = 'patch';
    const d: DiffType = null;
    expect([a, b, c, d]).toEqual(['major', 'minor', 'patch', null]);
  });
});

describe('PackageVersionInfo / VersionDiffResult', () => {
  it('包含版本检测所需字段', () => {
    const info: PackageVersionInfo = {
      packageName: '@x/a',
      packagePath: 'packages/a',
      currentVersion: '1.0.0',
      newVersion: '1.1.0',
    };
    const diff: VersionDiffResult = { package: info, diffType: 'minor' };
    expect(diff.diffType).toBe('minor');
    expectTypeOf(info.packageName).toBeString();
    expectTypeOf(diff.diffType).toEqualTypeOf<DiffType>();
  });
});

describe('GithubContext', () => {
  it('可选字段可为 undefined', () => {
    const ctx: GithubContext = { isGitHubActions: false, eventName: 'push' };
    expect(ctx.prNumber).toBeUndefined();
    expectTypeOf(ctx.repoOwner).toEqualTypeOf<string | undefined>();
  });
});

describe('ChangelogEntry / ChangelogFormatter', () => {
  it('ChangelogFormatter 的 format/formatLine 均为可选', () => {
    const lineFormatter: ChangelogFormatter = {
      name: 'x',
      formatLine: (l) => l,
    };
    expect(lineFormatter.format).toBeUndefined();
    expectTypeOf(lineFormatter.formatLine).toEqualTypeOf<
      ((line: string) => string) | undefined
    >();
  });

  it('ChangelogEntry 包含 subject 必需字段与可选元数据', () => {
    const entry: ChangelogEntry = { type: 'feat', subject: '登录' };
    expect(entry.scope).toBeUndefined();
    expectTypeOf(entry.prNumber).toEqualTypeOf<number | undefined>();
    expectTypeOf(entry.commitHash).toEqualTypeOf<string | undefined>();
  });
});

describe('ILineFormatter / ILogFormatter / ILogParser', () => {
  it('ILineFormatter 必需 formatLine', () => {
    const f: ILineFormatter = { name: 'f', formatLine: (l) => l };
    expect(f.formatLine('x')).toBe('x');
    expectTypeOf(f.formatLine).toBeFunction();
  });

  it('ILogFormatter 必需 format', () => {
    const f: ILogFormatter = { name: 'g', format: (log) => log };
    expect(f.format('a')).toBe('a');
    expectTypeOf(f.format).toBeFunction();
  });

  it('ILogParser 必需 parse，extractMetadata 可选', () => {
    const p: ILogParser = { name: 'p', parse: () => [] };
    expect(p.parse('')).toEqual([]);
    expectTypeOf(p.extractMetadata).toEqualTypeOf<
      ((entries: ChangelogEntry[]) => Record<string, unknown>) | undefined
    >();
  });
});

describe('IPlugin', () => {
  it('生命周期钩子均为可选，兼容 formatter', () => {
    const plugin: IPlugin = { name: 'p', formatLine: (l) => l };
    expectTypeOf(plugin.beforeCollect).toEqualTypeOf<
      ((context: ReleaseHookContext) => Promise<void>) | undefined
    >();
    expectTypeOf(plugin.formatLine).toEqualTypeOf<
      ((line: string) => string) | undefined
    >();
  });
});

describe('LoadedPlugins / LoadPluginsResult / Feature 结果', () => {
  it('LoadedPlugins 含 formatters 与 errors', () => {
    const loaded: LoadedPlugins = { formatters: [], errors: [] };
    expect(loaded.formatters).toHaveLength(0);
    expectTypeOf(loaded.formatters).toEqualTypeOf<ChangelogFormatter[]>();
  });

  it('LoadPluginsResult 同时含 plugins 与 formatters', () => {
    const result: LoadPluginsResult = { plugins: [], formatters: [], errors: [] };
    expectTypeOf(result.plugins).toEqualTypeOf<IPlugin[]>();
    expectTypeOf(result.formatters).toEqualTypeOf<ChangelogFormatter[]>();
  });

  it('PRLogCollectorResult / ReleasePreviewResult / ReleasePublisherResult 结构', () => {
    const collect: PRLogCollectorResult = {
      success: true,
      prNumber: 1,
      prTitle: 't',
      changelog: '',
      commentPosted: false,
      bodyUpdated: true,
    };
    expectTypeOf(collect.savedPath).toEqualTypeOf<string | undefined>();

    const preview: ReleasePreviewResult = {
      success: true,
      prNumber: 1,
      hasVersionChange: true,
      versionDiffs: [],
      commentPosted: false,
    };
    expectTypeOf(preview.versionDiffs).toEqualTypeOf<VersionDiffResult[]>();

    const publish: ReleasePublisherResult = {
      success: true,
      releases: [],
      errors: [],
    };
    expectTypeOf(publish.releases[0]).toEqualTypeOf<
      { packageName: string; tagName: string; releaseUrl?: string } | undefined
    >();
  });
});
