import { describe, it, expect } from 'vitest';
import { COMMIT_TYPE_EMOJI, COMMIT_TYPE_CATEGORY } from '@release-toolkit/changelog-presets';

describe('Constants', () => {
  describe('COMMIT_TYPE_EMOJI', () => {
    it('should have emoji for common commit types', () => {
      expect(COMMIT_TYPE_EMOJI.feat).toBe('✨');
      expect(COMMIT_TYPE_EMOJI.fix).toBe('🐛');
      expect(COMMIT_TYPE_EMOJI.docs).toBe('📝');
    });

    it('should have valid emoji strings', () => {
      Object.values(COMMIT_TYPE_EMOJI).forEach((emoji) => {
        expect(typeof emoji).toBe('string');
        expect(emoji.length).toBeGreaterThan(0);
      });
    });
  });

  describe('COMMIT_TYPE_CATEGORY', () => {
    it('should have category info for common commit types', () => {
      expect(COMMIT_TYPE_CATEGORY.feat).toEqual({
        name: 'Features',
        emoji: '✨',
      });
      expect(COMMIT_TYPE_CATEGORY.fix).toEqual({
        name: 'Bug Fixes',
        emoji: '🐛',
      });
    });

    it('should have valid category structure', () => {
      Object.values(COMMIT_TYPE_CATEGORY).forEach((category) => {
        expect(category).toHaveProperty('name');
        expect(category).toHaveProperty('emoji');
        expect(typeof category.name).toBe('string');
        expect(typeof category.emoji).toBe('string');
      });
    });
  });
});
