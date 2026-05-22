import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig } from '../shared/config/index.js';

describe('loadConfig configPath', () => {
  const dir = join(import.meta.dirname, '.tmp-load-config');

  beforeAll(() => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'custom-config.json'),
      JSON.stringify({ branches: { base: 'staging' } }),
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('应从 --config-path 指定文件加载并合并默认值', () => {
    const config = loadConfig({ cwd: dir, configPath: 'custom-config.json' });
    expect(config.branches.base).toBe('staging');
    expect(config.plugins.length).toBeGreaterThan(0);
  });
});
