import { describe, it, expect } from 'vitest';
import { extractReleaseLog } from '../features/pr-log-collector/release-log-extractor.js';
import type { ReleaseToolkitConfig } from '../shared/config/index.js';

// Minimal config for testing
const defaultConfig: ReleaseToolkitConfig = {
  branches: { base: 'main' },
  prLogCollector: {
    releaseLogMarker: {
      start: '<!-- RELEASE-LOG-START -->',
      end: '<!-- RELEASE-LOG-END -->',
    },
  },
  releasePreview: {
    workspaceFile: 'pnpm-workspace.yaml',
    noChangeMessage: '⚠️ 本次 PR 未检测到任何包的版本变更，合并后将不会触发发布。',
  },
  releasePublisher: {
    createGithubRelease: true,
  },
  plugins: [],
};

describe('extractReleaseLog', () => {
  describe('Format A: With package names and change log', () => {
    it('should parse single package with change log', () => {
      const body = `Some PR description

<!-- RELEASE-LOG-START -->
## package-a

### 变更日志
- Feature 1
- Fix 2

<!-- RELEASE-LOG-END -->

More content`;

      const result = extractReleaseLog(body, defaultConfig);

      expect(result.packageChangeLogs).toHaveLength(1);
      expect(result.packageChangeLogs[0].packages).toEqual(['package-a']);
      expect(result.packageChangeLogs[0].changeLog).toContain('Feature 1');
      expect(result.rawReleaseLog).toContain('## package-a');
    });

    it('should parse multiple packages separated by comma', () => {
      const body = `<!-- RELEASE-LOG-START -->
## package-a, package-b

### 变更日志
- Shared feature

<!-- RELEASE-LOG-END -->`;

      const result = extractReleaseLog(body, defaultConfig);

      expect(result.packageChangeLogs).toHaveLength(1);
      expect(result.packageChangeLogs[0].packages).toEqual(['package-a', 'package-b']);
    });
  });

  describe('Format B: Multiple sections', () => {
    it('should parse multiple package sections', () => {
      const body = `<!-- RELEASE-LOG-START -->
## package-a

### 变更日志
- Feature A

## package-b

### 变更日志
- Feature B

<!-- RELEASE-LOG-END -->`;

      const result = extractReleaseLog(body, defaultConfig);

      expect(result.packageChangeLogs).toHaveLength(2);
      expect(result.packageChangeLogs[0].packages).toEqual(['package-a']);
      expect(result.packageChangeLogs[0].changeLog).toContain('Feature A');
      expect(result.packageChangeLogs[1].packages).toEqual(['package-b']);
      expect(result.packageChangeLogs[1].changeLog).toContain('Feature B');
    });
  });

  describe('Format C: No package declaration', () => {
    it('should treat entire content as generic change log', () => {
      const body = `<!-- RELEASE-LOG-START -->
### 变更日志
- Generic feature 1
- Generic fix 2
<!-- RELEASE-LOG-END -->`;

      const result = extractReleaseLog(body, defaultConfig);

      expect(result.packageChangeLogs).toHaveLength(1);
      expect(result.packageChangeLogs[0].packages).toEqual([]); // Empty = applies to all
      expect(result.packageChangeLogs[0].changeLog).toContain('Generic feature 1');
    });

    it('should handle content without ### header', () => {
      const body = `<!-- RELEASE-LOG-START -->
- Direct log entry 1
- Direct log entry 2
<!-- RELEASE-LOG-END -->`;

      const result = extractReleaseLog(body, defaultConfig);

      expect(result.packageChangeLogs).toHaveLength(1);
      expect(result.packageChangeLogs[0].packages).toEqual([]);
      expect(result.packageChangeLogs[0].changeLog).toContain('Direct log entry 1');
    });
  });

  describe('Format D: New bullet style without ### subheadings', () => {
    it('should parse `## pkg` followed by direct bullet list', () => {
      const body = `<!-- RELEASE-LOG-START -->
## package-a
- feat: 新增登录功能（标题）
- 新增微信登录
- 修复定时器问题
<!-- RELEASE-LOG-END -->`;

      const result = extractReleaseLog(body, defaultConfig);

      expect(result.packageChangeLogs).toHaveLength(1);
      expect(result.packageChangeLogs[0].packages).toEqual(['package-a']);
      expect(result.packageChangeLogs[0].changeLog).toContain('新增登录');
      expect(result.packageChangeLogs[0].changeLog).toContain('修复定时器');
    });

    it('should parse multiple `## pkg` sections with direct bullets', () => {
      const body = `<!-- RELEASE-LOG-START -->
## package-a
- feat: A 功能（标题）
- A 的细节

## package-b
- fix: B 修复（标题）
- B 的细节
<!-- RELEASE-LOG-END -->`;

      const result = extractReleaseLog(body, defaultConfig);

      expect(result.packageChangeLogs).toHaveLength(2);
      expect(result.packageChangeLogs[0].packages).toEqual(['package-a']);
      expect(result.packageChangeLogs[0].changeLog).toContain('A 功能');
      expect(result.packageChangeLogs[1].packages).toEqual(['package-b']);
      expect(result.packageChangeLogs[1].changeLog).toContain('B 修复');
    });

    it('should skip `### *` subheadings while keeping bullets', () => {
      const body = `<!-- RELEASE-LOG-START -->
## package-a
### 标题
feat: 自定义标题（被跳过）
### 变更日志
- 第一条
- 第二条
<!-- RELEASE-LOG-END -->`;

      const result = extractReleaseLog(body, defaultConfig);

      expect(result.packageChangeLogs).toHaveLength(1);
      expect(result.packageChangeLogs[0].packages).toEqual(['package-a']);
      // `### 标题` 下方的非列表行（自定义标题）会被收集为通用文本
      expect(result.packageChangeLogs[0].changeLog).toContain('第一条');
      expect(result.packageChangeLogs[0].changeLog).toContain('第二条');
    });
  });

  describe('Edge cases', () => {
    it('should return empty when markers are missing', () => {
      const body = 'No markers here';
      const result = extractReleaseLog(body, defaultConfig);

      expect(result.packageChangeLogs).toHaveLength(0);
      expect(result.rawReleaseLog).toBeNull();
      expect(result.bodyWithoutMarker).toBe(body);
    });

    it('should return empty when body is null', () => {
      const result = extractReleaseLog(null, defaultConfig);

      expect(result.packageChangeLogs).toHaveLength(0);
      expect(result.rawReleaseLog).toBeNull();
      expect(result.bodyWithoutMarker).toBe('');
    });

    it('should handle custom markers', () => {
      const config: ReleaseToolkitConfig = {
        branches: { base: 'main' },
        prLogCollector: {
          releaseLogMarker: {
            start: '<!-- CUSTOM-START -->',
            end: '<!-- CUSTOM-END -->',
          },
        },
        releasePreview: {
          workspaceFile: 'pnpm-workspace.yaml',
          noChangeMessage: '⚠️ 本次 PR 未检测到任何包的版本变更，合并后将不会触发发布。',
        },
        releasePublisher: {
          createGithubRelease: true,
        },
        plugins: [],
      };

      const body = `<!-- CUSTOM-START -->
## my-package

### 变更日志
- Custom feature
<!-- CUSTOM-END -->`;

      const result = extractReleaseLog(body, config);

      expect(result.packageChangeLogs).toHaveLength(1);
      expect(result.packageChangeLogs[0].packages).toEqual(['my-package']);
    });

    it('should extract bodyWithoutMarker correctly', () => {
      const body = `Before

<!-- RELEASE-LOG-START -->
## pkg

### 变更日志
- Feature
<!-- RELEASE-LOG-END -->

After`;

      const result = extractReleaseLog(body, defaultConfig);

      // Actual behavior: preserves whitespace around removed marker region
      // "Before\n\n" + "\n\nAfter" = "Before\n\n\n\nAfter", then trim
      expect(result.bodyWithoutMarker).toBe('Before\n\n\n\nAfter');
    });
  });
});
