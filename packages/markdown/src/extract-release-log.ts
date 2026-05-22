import {
  DEFAULT_RELEASE_LOG_MARKERS,
  type ReleaseLogMarkers,
} from './markers.js';
import { parseReleaseLog, type PackageChangeLog } from './parse-release-log.js';

export interface ExtractedReleaseLog {
  rawReleaseLog: string | null;
  packageChangeLogs: PackageChangeLog[];
  /** 移除标记区后的 body（可选，供 core 写回 PR） */
  bodyWithoutMarker?: string;
}

export function extractReleaseLogFromBody(
  body: string | null,
  markers: ReleaseLogMarkers = DEFAULT_RELEASE_LOG_MARKERS,
  options?: { includeBodyWithoutMarker?: boolean },
): ExtractedReleaseLog {
  if (!body) {
    return { rawReleaseLog: null, packageChangeLogs: [] };
  }

  const startIdx = body.indexOf(markers.start);
  const endIdx = body.indexOf(markers.end);

  if (startIdx === -1 || endIdx === -1 || startIdx >= endIdx) {
    return {
      rawReleaseLog: null,
      packageChangeLogs: [],
      ...(options?.includeBodyWithoutMarker && { bodyWithoutMarker: body }),
    };
  }

  const raw = body.substring(startIdx + markers.start.length, endIdx).trim();
  const result: ExtractedReleaseLog = {
    rawReleaseLog: raw || null,
    packageChangeLogs: parseReleaseLog(raw),
  };

  if (options?.includeBodyWithoutMarker) {
    result.bodyWithoutMarker = (
      body.substring(0, startIdx) + body.substring(endIdx + markers.end.length)
    ).trim();
  }

  return result;
}
