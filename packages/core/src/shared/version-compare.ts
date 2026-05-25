import { compare } from 'semver';

/**
 * 比较两个版本号，返回变更类型
 * 使用 semver 库进行准确比较
 */
export function compareVersions(v1: string, v2: string): 'major' | 'minor' | 'patch' | null {
  const v1Normalized = v1.split('-')[0] || v1;
  const v2Normalized = v2.split('-')[0] || v2;

  try {
    const c = compare(v1Normalized, v2Normalized);
    if (c < 0) {
      const p1 = v1Normalized.split('.').map(Number);
      const p2 = v2Normalized.split('.').map(Number);

      if (p2[0] > p1[0]) return 'major';
      if (p2[1] > p1[1]) return 'minor';
      if (p2[2] > p1[2]) return 'patch';
    }
    return null;
  } catch {
    const parts1 = v1Normalized.split('.').map(Number);
    const parts2 = v2Normalized.split('.').map(Number);

    if (parts2[0] > parts1[0]) return 'major';
    if (parts2[1] > parts1[1]) return 'minor';
    if (parts2[2] > parts1[2]) return 'patch';
    return null;
  }
}
