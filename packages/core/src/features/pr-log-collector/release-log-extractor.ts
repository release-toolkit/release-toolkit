import type { ReleaseToolkitConfig } from '../../shared/config/index.js';
import {
  extractReleaseLogFromBody,
  parseReleaseLog,
  type PackageChangeLog,
} from '@release-toolkit/markdown';

export type { PackageChangeLog };

export interface ExtractResult {
  packageChangeLogs: PackageChangeLog[];
  rawReleaseLog: string | null;
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

  const markers = {
    start:
      config.prLogCollector?.releaseLogMarker?.start ?? '<!-- RELEASE-LOG-START -->',
    end:
      config.prLogCollector?.releaseLogMarker?.end ?? '<!-- RELEASE-LOG-END -->',
  };

  const extracted = extractReleaseLogFromBody(body, markers, {
    includeBodyWithoutMarker: true,
  });

  return {
    packageChangeLogs: extracted.packageChangeLogs,
    rawReleaseLog: extracted.rawReleaseLog,
    bodyWithoutMarker: extracted.bodyWithoutMarker ?? body,
  };
}

/** @internal 供测试直接解析标记区正文 */
export { parseReleaseLog };
