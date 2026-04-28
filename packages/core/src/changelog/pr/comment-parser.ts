// ============================================================
// Constants
// ============================================================

/** Directory for PR-level changelog files */
export const PR_CHANGELOG_DIR = 'changelog/prs';

/** Markers used in PR review comments to delimit release log content */
export const RELEASE_LOG_START = '<!-- RELEASE-LOG-START -->';
export const RELEASE_LOG_END = '<!-- RELEASE-LOG-END -->';

/** Marker for explicitly declaring affected packages in PR comment */
export const PACKAGES_MARKER = '<!-- PACKAGES:';  // e.g. <!-- PACKAGES: @pkg/a, @pkg/b -->

// ============================================================
// Comment Parsers
// ============================================================

/**
 * Extract content between `<!-- RELEASE-LOG-START -->` and `<!-- RELEASE-LOG-END -->`
 * Returns null if markers not found.
 */
export function extractReleaseLog(commentBody: string): string | null {
  const startIdx = commentBody.indexOf(RELEASE_LOG_START);
  const endIdx = commentBody.indexOf(RELEASE_LOG_END);

  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return null;

  return commentBody
    .slice(startIdx + RELEASE_LOG_START.length, endIdx)
    .trim();
}

/**
 * Extract explicitly declared packages from PR first comment.
 * Format: `<!-- PACKAGES: @pkg/a, @pkg/b, @pkg/c -->`
 * Returns null if marker not found or content is empty.
 */
export function extractDeclaredPackages(commentBody: string): string[] | null {
  const idx = commentBody.indexOf(PACKAGES_MARKER);
  if (idx === -1) return null;

  const start = idx + PACKAGES_MARKER.length;
  const endIdx = commentBody.indexOf('-->', start);
  if (endIdx === -1) return null;

  const raw = commentBody.slice(start, endIdx).trim();
  if (!raw) return null;

  // Split by comma, trim whitespace, filter empty
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .sort();
}
