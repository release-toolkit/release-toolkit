import type { GitTagsConfig } from './index.js';

const DEFAULT_TAG_FORMAT = '{packageName}@{version}';
const DEFAULT_TAG_MESSAGE = 'Release {packageName}@{version}';

/** 将模板中的 {packageName}、{version} 替换为实际值 */
export function applyGitTagTemplate(
  template: string,
  packageName: string,
  version: string,
): string {
  return template
    .replace(/\{packageName\}/g, packageName)
    .replace(/\{version\}/g, version);
}

export function resolveGitTagName(
  gitTags: GitTagsConfig | undefined,
  packageName: string,
  version: string,
): string {
  const format = gitTags?.format ?? DEFAULT_TAG_FORMAT;
  return applyGitTagTemplate(format, packageName, version);
}

export function resolveGitTagMessage(
  gitTags: GitTagsConfig | undefined,
  packageName: string,
  version: string,
): string {
  const message = gitTags?.message ?? DEFAULT_TAG_MESSAGE;
  return applyGitTagTemplate(message, packageName, version);
}
