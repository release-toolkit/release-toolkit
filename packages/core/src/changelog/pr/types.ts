// ============================================================
// PR Changelog Types — Per-PR change record
// ============================================================

/** A single commit title extracted from a PR */
export interface CommitTitle {
  /** Short hash, e.g. "a1b2c3d" */
  hash: string;
  /** Full commit message subject line */
  subject: string;
}

/** The first review comment on the PR (for structured notes) */
export interface PRReviewNote {
  /** Comment author GitHub login */
  author: string;
  /** Raw comment body text */
  body: string;
  /** Comment creation time (ISO) */
  createdAt: string;
}

/** PR metadata / header info */
export interface PRMeta {
  /** Pull request number */
  number: number;
  /** PR title */
  title: string;
  /** PR author GitHub login */
  author: string;
  /** PR state: open | closed | merged */
  state: 'open' | 'closed' | 'merged';
  /** Labels attached to the PR */
  labels: string[];
  /** ISO timestamp when PR was created */
  createdAt: string;
  /** ISO timestamp when PR was merged/closed (if applicable) */
  mergedAt?: string;
  /** Who merged the PR */
  mergedBy?: string;
  /** Base branch name */
  baseRef: string;
  /** Head branch name */
  headRef: string;
  /** PR body text (raw markdown) */
  body?: string;
}

/** Related info section — review note + file change stats */
export interface PRRelatedInfo {
  /** The first review comment with structured content (if any) */
  reviewNote?: PRReviewNote;
  /** File change stats from GitHub API */
  filesChanged?: {
    count: number;
    additions: number;
    deletions: number;
  };
}

/** Complete data for one PR's changelog entry */
export interface PRChangelogData {
  meta: PRMeta;
  /** Affected package names (shown in the `---` block) */
  packages: string[];
  /** Commit titles (raw, one per line in output) */
  entries: CommitTitle[];
  related: PRRelatedInfo;
}
