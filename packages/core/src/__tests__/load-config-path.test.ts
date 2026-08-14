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

describe('loadConfig local overrides (.local/config.json)', () => {
  const dir = join(import.meta.dirname, '.tmp-local-config');
  const localDir = join(dir, '.release-toolkit', '.local');

  beforeAll(() => {
    mkdirSync(localDir, { recursive: true });
    writeFileSync(
      join(dir, '.release-toolkit', 'config.json'),
      JSON.stringify({ branches: { base: 'staging' } }),
    );
    writeFileSync(
      join(localDir, 'config.json'),
      JSON.stringify({ branches: { base: 'local-dev' } }),
    );
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('本地覆盖配置优先级高于主配置', () => {
    const config = loadConfig({ cwd: dir });
    expect(config.branches.base).toBe('local-dev');
  });

  it('可通过 localOverrides=false 禁用本地覆盖，回退到主配置', () => {
    const config = loadConfig({ cwd: dir, localOverrides: false });
    expect(config.branches.base).toBe('staging');
  });

  it('主配置缺失时仅保留本地覆盖与默认值合并', () => {
    const onlyLocal = join(import.meta.dirname, '.tmp-local-only');
    mkdirSync(join(onlyLocal, '.release-toolkit', '.local'), { recursive: true });
    writeFileSync(
      join(onlyLocal, '.release-toolkit', '.local', 'config.json'),
      JSON.stringify({ branches: { base: 'edge' } }),
    );
    try {
      const config = loadConfig({ cwd: onlyLocal });
      expect(config.branches.base).toBe('edge');
      expect(config.plugins.length).toBeGreaterThan(0);
    } finally {
      rmSync(onlyLocal, { recursive: true, force: true });
    }
  });
});
