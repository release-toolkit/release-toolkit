import { escapeRegex } from './escape.js';
import { OUTPUT_END, OUTPUT_START } from './markers.js';

/** 用 RELEASE-TOOLKIT-OUTPUT 标记包裹正文 */
export function wrapOutputMarkers(content: string): string {
  return `${OUTPUT_START}\n${content}\n${OUTPUT_END}`;
}

export interface UpsertOutputOptions {
  /** 是否全局替换所有匹配区（默认只替换第一处） */
  replaceAll?: boolean;
}

/**
 * 幂等更新 PR 描述体中的 RELEASE-TOOLKIT-OUTPUT 区。
 * 无标记区时追加到末尾；body 为空时仅输出标记区。
 */
export function upsertOutputInBody(
  currentBody: string | null,
  innerContent: string,
  options?: UpsertOutputOptions,
): string {
  const body = currentBody ?? '';
  const wrapped = wrapOutputMarkers(innerContent);

  if (body.includes(OUTPUT_START) && body.includes(OUTPUT_END)) {
    const flags = options?.replaceAll ? 'g' : '';
    return body.replace(
      new RegExp(`${escapeRegex(OUTPUT_START)}[\\s\\S]*?${escapeRegex(OUTPUT_END)}`, flags),
      wrapped,
    );
  }

  return body.trim() ? `${body}\n\n${wrapped}` : wrapped;
}
