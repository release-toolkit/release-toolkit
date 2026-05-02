import type { ReleaseToolkitConfig } from '../../shared/config/index.js';

interface ExtractResult {
  releaseLog: string | null;
  bodyWithoutMarker: string;
}

export function extractReleaseLog(
  body: string | null,
  config: ReleaseToolkitConfig,
): ExtractResult {
  if (!body) {
    return { releaseLog: null, bodyWithoutMarker: '' };
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
    return { releaseLog: null, bodyWithoutMarker: body };
  }

  const releaseLog = body
    .substring(startIdx + startMarker.length, endIdx)
    .trim();

  const bodyWithoutMarker =
    body.substring(0, startIdx) + body.substring(endIdx + endMarker.length);

  return {
    releaseLog: releaseLog || null,
    bodyWithoutMarker: bodyWithoutMarker.trim(),
  };
}
