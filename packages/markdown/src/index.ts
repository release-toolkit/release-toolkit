export {
  RELEASE_LOG_START,
  RELEASE_LOG_END,
  OUTPUT_START,
  OUTPUT_END,
  OUTPUT_MARKERS,
  COMMENT_ANCHOR_START,
  COMMENT_ANCHOR_END,
  LEGACY_COMMENT_ANCHOR_STARTS,
  DEFAULT_RELEASE_LOG_MARKERS,
  isToolCommentBody,
  bodyHasReleaseLogMarkers,
  wrapToolComment,
  type ReleaseLogMarkers,
} from './markers.js';

export {
  wrapOutputMarkers,
  upsertOutputInBody,
  type UpsertOutputOptions,
} from './output-body.js';

export { COMMIT_TYPE_EMOJI, applyEmojiPrefixToLine } from './emoji.js';

export { EMPTY_CHANGELOG_BULLET, toBulletLines } from './bullets.js';

export {
  formatTitleBulletLine,
  formatTitleBulletWithEmoji,
} from './title-bullet.js';

export {
  formatChangeLogBulletsPlain,
  formatChangeLogBulletsFromBody,
} from './changelog-bullets.js';

export { parseReleaseLog, type PackageChangeLog } from './parse-release-log.js';

export {
  extractReleaseLogFromBody,
  type ExtractedReleaseLog,
} from './extract-release-log.js';

export { escapeRegex } from './escape.js';
