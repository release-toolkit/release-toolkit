import { describe, it, expect } from 'vitest';
import * as core from '../index.js';

describe('Core Package', () => {
  it('should export all required functions', () => {
    // Check shared types
    expect(core).toHaveProperty('loadConfig');
    expect(core).toHaveProperty('detectGithubContext');

    // Check features
    expect(core).toHaveProperty('collectPRLog');
    expect(core).toHaveProperty('previewRelease');
    expect(core).toHaveProperty('publishRelease');
  });

  it('should have correct module structure', () => {
    const exportedKeys = Object.keys(core);
    expect(exportedKeys.length).toBeGreaterThan(0);
  });
});
