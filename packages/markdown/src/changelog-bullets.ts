import { EMPTY_CHANGELOG_BULLET, toBulletLines } from './bullets.js';
import { applyEmojiPrefixToLine } from './emoji.js';

/** 无插件：列表化 + 每行 emoji（App Server / 默认预览） */
export function formatChangeLogBulletsPlain(changeLog: string): string[] {
  const trimmed = changeLog.trim();
  if (!trimmed) return [EMPTY_CHANGELOG_BULLET];
  const bullets = toBulletLines(trimmed);
  return bullets.length > 0
    ? bullets.map(applyEmojiPrefixToLine)
    : [EMPTY_CHANGELOG_BULLET];
}

/**
 * 先对正文做可选转换（如 core 插件 formatters），再列表化。
 * @param transformBody 接收 trim 后的原文，返回格式化后的正文
 */
export function formatChangeLogBulletsFromBody(
  changeLog: string,
  transformBody?: (trimmed: string) => string,
): string[] {
  const trimmed = changeLog.trim();
  if (!trimmed) return [EMPTY_CHANGELOG_BULLET];

  const body = transformBody ? transformBody(trimmed) : trimmed;
  const bullets = toBulletLines(body.trim() ? body : trimmed);
  return bullets.length > 0 ? bullets : [EMPTY_CHANGELOG_BULLET];
}
