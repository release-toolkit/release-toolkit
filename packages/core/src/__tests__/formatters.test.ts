import { describe, it, expect } from 'vitest';
import { emojiPrefix, markdownBold } from '@release-toolkit/changelog-presets';

describe('Formatters', () => {
  describe('emojiPrefix', () => {
    it('should add emoji prefix to conventional commits', () => {
      const result = emojiPrefix.formatLine('feat(auth): add login');
      expect(result).toBe('✨ feat(auth): add login');
    });

    it('should handle different commit types', () => {
      expect(markdownBold.formatLine('fix: bug fix')).toBe('🐛 fix: bug fix');
      expect(markdownBold.formatLine('docs: update README')).toBe('📝 docs: update README');
    });

    it('should return original line for unknown types', () => {
      const line = 'unknown: some message';
      expect(emojiPrefix.formatLine(line)).toBe(line);
    });
  });

  describe('markdownBold', () => {
    it('should make scope bold', () => {
      const result = markdownBold.formatLine('feat(auth): add login');
      expect(result).toBe('feat(**auth**): add login');
    });

    it('should handle commits without scope', () => {
      const line = 'feat: add feature';
      expect(markdownBold.formatLine(line)).toBe(line);
    });
  });
});
