import { describe, it, expect } from 'vitest';
import { diffFiles, getCurrentSha } from '../shared/git/git-reader.js';
import { loadConfig } from '../shared/config/index.js';

describe('Version Utils', () => {
  describe('loadConfig', () => {
    it('should load default config when no config file exists', async () => {
      const config = await loadConfig('/tmp/non-existent-path');
      expect(config).toHaveProperty('devBranch');
      expect(config).toHaveProperty('productionBranch');
    });

    it('should have correct default values', async () => {
      const config = await loadConfig('/tmp/non-existent-path');
      expect(config.devBranch).toBe('dev');
      expect(config.productionBranch).toBe('main');
    });
  });

  describe('git utilities', () => {
    it('should export diffFiles function', () => {
      expect(typeof diffFiles).toBe('function');
    });

    it('should export getCurrentSha function', () => {
      expect(typeof getCurrentSha).toBe('function');
    });
  });
});
