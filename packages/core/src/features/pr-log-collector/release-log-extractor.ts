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

/** 解析 RELEASE-LOG 标记区内容，支持格式 A/B/C */
function parseReleaseLog(content: string): PackageChangeLog[] {
  const lines = content.split('\n');
  const result: PackageChangeLog[] = [];

  let currentPackages: string[] = [];
  let currentChangeLogLines: string[] = [];
  let inChangeLog = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();

    // 检测包名行：## package-a, package-b 或 ## package-a
    if (trimmedLine.startsWith('## ') && !trimmedLine.startsWith('### ')) {
      // 保存前一段
      if (inChangeLog && currentChangeLogLines.length > 0) {
        result.push({
          packages: currentPackages,
          changeLog: currentChangeLogLines.join('\n').trim(),
        });
      }

      // 解析包名
      const packageNames = trimmedLine
        .replace(/^## /, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      currentPackages = packageNames;
      currentChangeLogLines = [];
      inChangeLog = false;
      continue;
    }

    // 检测变更日志开始：### 变更日志
    if (trimmedLine.startsWith('### ')) {
      inChangeLog = true;
      continue; // 跳过标题行，只保留内容
    }

    // 收集变更日志内容
    if (inChangeLog) {
      currentChangeLogLines.push(line);
    }
  }

  // 保存最后一段
  if (inChangeLog && currentChangeLogLines.length > 0) {
    result.push({
      packages: currentPackages,
      changeLog: currentChangeLogLines.join('\n').trim(),
    });
  }

  // 如果没有解析到任何结构（格式 C：无包名声明），将整个内容作为通用变更日志
  if (result.length === 0 && content.trim()) {
    result.push({
      packages: [], // 空数组表示应用到所有变更包
      changeLog: content.trim(),
    });
  }

  return result;
}
