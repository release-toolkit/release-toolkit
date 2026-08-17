import { describe, it, expect } from 'vitest';
import { collectCommand } from '../commands/collect.js';
import { previewCommand } from '../commands/preview.js';
import { publishCommand } from '../commands/publish.js';

/** 读取某个 option 的 flags 定义 */
function optionFlag(cmd: { options: Array<{ flags: string }> }, key: string) {
  return cmd.options.find((o) => o.flags.includes(key))?.flags;
}

describe('CLI 命令注册', () => {
  it('collect 命令名与描述正确', () => {
    expect(collectCommand.name()).toBe('collect');
    expect(collectCommand.description()).toContain('收集 PR 日志');
  });

  it('preview 命令名与描述正确', () => {
    expect(previewCommand.name()).toBe('preview');
    expect(previewCommand.description()).toContain('版本发布预览');
  });

  it('publish 命令名与描述正确', () => {
    expect(publishCommand.name()).toBe('publish');
    expect(publishCommand.description()).toContain('发布版本');
  });
});

describe('collect 命令参数', () => {
  it('必填 --pr-number/--owner/--repo', () => {
    expect(optionFlag(collectCommand, '--pr-number')).toBe('--pr-number <number>');
    expect(optionFlag(collectCommand, '--owner')).toBe('--owner <owner>');
    expect(optionFlag(collectCommand, '--repo')).toBe('--repo <repo>');
  });

  it('可选 --token/--save/--no-save/--cwd/--config-path', () => {
    expect(optionFlag(collectCommand, '--token')).toBe('--token <token>');
    expect(optionFlag(collectCommand, '--save')).toBe('--save');
    expect(optionFlag(collectCommand, '--no-save')).toBe('--no-save');
    expect(optionFlag(collectCommand, '--cwd')).toBe('--cwd <path>');
    expect(optionFlag(collectCommand, '--config-path')).toBe('--config-path <path>');
  });
});

describe('preview 命令参数', () => {
  it('必填 --pr-number/--owner/--repo', () => {
    expect(optionFlag(previewCommand, '--pr-number')).toBe('--pr-number <number>');
    expect(optionFlag(previewCommand, '--owner')).toBe('--owner <owner>');
    expect(optionFlag(previewCommand, '--repo')).toBe('--repo <repo>');
  });

  it('可选 --branch/--token/--cwd/--config-path', () => {
    expect(optionFlag(previewCommand, '--branch')).toBe('--branch <branch>');
    expect(optionFlag(previewCommand, '--token')).toBe('--token <token>');
    expect(optionFlag(previewCommand, '--cwd')).toBe('--cwd <path>');
    expect(optionFlag(previewCommand, '--config-path')).toBe('--config-path <path>');
  });
});

describe('publish 命令参数', () => {
  it('全部为可选参数', () => {
    expect(optionFlag(publishCommand, '--owner')).toBe('--owner <owner>');
    expect(optionFlag(publishCommand, '--repo')).toBe('--repo <repo>');
    expect(optionFlag(publishCommand, '--token')).toBe('--token <token>');
    expect(optionFlag(publishCommand, '--branch')).toBe('--branch <branch>');
    expect(optionFlag(publishCommand, '--dry-run')).toBe('--dry-run');
    expect(optionFlag(publishCommand, '--cwd')).toBe('--cwd <path>');
    expect(optionFlag(publishCommand, '--config-path')).toBe('--config-path <path>');
  });
});
