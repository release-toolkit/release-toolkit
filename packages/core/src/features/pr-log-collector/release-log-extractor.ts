import type { ReleaseToolkitConfig } from '../../shared/config/index.js';

export interface PackageChangeLog {
  packages: string[]; // 包名列表（空数组表示应用到所有变更包）
  changeLog: string; // 变更日志内容
}

interface ExtractResult {
  packageChangeLogs: PackageChangeLog[]; // 结构化数据
  rawReleaseLog: string | null; // 原始标记区内容（向后兼容）
  bodyWithoutMarker: string;
}

/** 解析 RELEASE-LOG 标记区，支持格式 A/B/C */
export function extractReleaseLog(
  body: string | null,
  config: ReleaseToolkitConfig,
): ExtractResult {
  if (!body) {
    return { packageChangeLogs: [], rawReleaseLog: null, bodyWithoutMarker: '' };
  }

  const startMarker =
    config.prLogCollector?.releaseLogMarker?.start ??
    '<!-- RELEASE-LOG-START -->';
  const endMarker =
    config.prLogCollector?.releaseLogMarker?.end ??
    '<!-- RELEASE-LOG-END -->';

  const startIdx = body.indexOf(startMarker);
  const endIdx = body.indexOf(endMarker);

  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
    return { packageChangeLogs: [], rawReleaseLog: null, bodyWithoutMarker: body };
  }

  const releaseLog = body
    .substring(startIdx + startMarker.length, endIdx)
    .trim();

  const bodyWithoutMarker =
    body.substring(0, startIdx) + body.substring(endIdx + endMarker.length);

  // 解析结构化内容
  const packageChangeLogs = parseReleaseLog(releaseLog);

  return {
    packageChangeLogs,
    rawReleaseLog: releaseLog || null,
    bodyWithoutMarker: bodyWithoutMarker.trim(),
  };
}

/**
 * 解析 RELEASE-LOG 标记区内容
 *
 * 支持的写法：
 * 1. `## pkg-a, pkg-b` 后紧跟列表项 / 文本（推荐）
 * 2. 兼容旧格式：`## pkg` → `### 标题` / `### 变更日志` 的所有 `### *` 子标题会被跳过，
 *    后续的列表项 / 文本会作为该包的 changeLog 收集
 * 3. 无 `## 包名` 时，整个内容作为「通用变更日志」，应用到所有变更包
 */
function parseReleaseLog(content: string): PackageChangeLog[] {
  const trimmedContent = content.trim();
  if (!trimmedContent) return [];

  const lines = trimmedContent.split('\n');
  const result: PackageChangeLog[] = [];

  let currentPackages: string[] = [];
  let currentLines: string[] = [];
  let started = false;

  const flush = () => {
    const log = currentLines.join('\n').trim();
    if (!log) return;
    result.push({ packages: [...currentPackages], changeLog: log });
  };

  for (const line of lines) {
    const trimmedLine = line.trim();

    // 包名分组：## package-a, package-b
    if (trimmedLine.startsWith('## ') && !trimmedLine.startsWith('### ')) {
      if (started) flush();
      currentPackages = trimmedLine
        .replace(/^## /, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      currentLines = [];
      started = true;
      continue;
    }

    // 跳过任意 `### *` 子标题（兼容旧 `### 标题` / `### 变更日志`）
    if (trimmedLine.startsWith('### ')) {
      continue;
    }

    if (started) {
      currentLines.push(line);
    } else {
      // 第一个 `##` 之前的内容，作为通用变更日志
      currentLines.push(line);
    }
  }

  if (started) {
    flush();
  } else {
    const log = currentLines.join('\n').trim();
    if (log) {
      result.push({ packages: [], changeLog: log });
    }
  }

  return result;
}
