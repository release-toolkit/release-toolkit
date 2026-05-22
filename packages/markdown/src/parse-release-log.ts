export interface PackageChangeLog {
  /** 包名列表（空数组表示应用到所有变更包） */
  packages: string[];
  changeLog: string;
}

/**
 * 解析 RELEASE-LOG 标记区内容。
 *
 * - `## pkg-a, pkg-b` 后紧跟列表 / 文本
 * - 跳过 `### *` 子标题（兼容旧格式）
 * - 无 `##` 时整段作为通用变更日志
 */
export function parseReleaseLog(content: string): PackageChangeLog[] {
  const trimmed = content.trim();
  if (!trimmed) return [];

  const lines = trimmed.split('\n');
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
    const t = line.trim();

    if (t.startsWith('## ') && !t.startsWith('### ')) {
      if (started) flush();
      currentPackages = t
        .replace(/^## /, '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      currentLines = [];
      started = true;
      continue;
    }

    if (t.startsWith('### ')) {
      continue;
    }

    if (started) {
      currentLines.push(line);
    } else {
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
