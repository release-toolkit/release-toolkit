import type { GitHubPRDetail, GitHubCommit, GitHubPRFile, GitHubComment } from './github-api.js';
import type { PRChangelogConfig } from '../../../config/index.js';
import { extractDeclaredPackages } from '../comment-parser.js';

// ============================================================
// Package resolver — priority order:
//   1. Explicit declaration from comment
//   2. Diff inference from file paths
//   3. Fallback from commit messages + labels
// ============================================================

/**
 * Resolve affected package list — priority order:
 *
 * 1. **Explicit declaration** from first PR comment: `<!-- PACKAGES: @pkg/a, @pkg/b -->`
 * 2. **Diff inference** — map changed file paths to package directories using config
 * 3. **Fallback** — extract from commit messages & labels (legacy regex match)
 *
 * Uses configurable packagesDir, packageMap, and rootTag.
 */
export function resolvePackages(
  pr: GitHubPRDetail,
  commits: GitHubCommit[],
  files: GitHubPRFile[],
  comments: GitHubComment[],
  cfg: Required<PRChangelogConfig>,
): string[] {

  // ── Priority 1: Explicit declaration from first comment ──
  if (comments.length > 0) {
    const declared = extractDeclaredPackages(comments[0].body);
    if (declared && declared.length > 0) {
      return declared;
    }
  }

  // ── Priority 2: Diff-based inference from file paths (with config) ──
  const diffPkgs = inferPackagesFromFiles(files, cfg);
  if (diffPkgs.length > 0) {
    return diffPkgs;
  }

  // ── Priority 3: Fallback — commit messages + labels ──
  return fallbackExtractPackages(pr, commits, cfg);
}

/**
 * Infer package names from changed file paths.
 *
 * Uses configurable:
 *   - `packagesDir`: the monorepo packages directory name (default "packages")
 *   - `packageMap`: directory name → explicit package name mapping
 *   - `rootTag`: tag for non-package files (default "root")
 *
 * Strategy:
 * - Files under `{packagesDir}/{dirname}/...` → resolve via packageMap or heuristic
 * - Files NOT under `{packagesDir}/` → tagged as configured `rootTag`
 */
function inferPackagesFromFiles(files: GitHubPRFile[], cfg: Required<PRChangelogConfig>): string[] {
  const pkgs = new Set<string>();
  let hasNonPackageFile = false;

  for (const f of files) {
    const segments = f.filename.split('/');

    // Check if file is under {packagesDir}/{name}/
    if (segments[0] === cfg.packagesDir && segments[1]) {
      const pkgDirName = segments[1];
      // Use explicit map if available, otherwise fallback to @dirName heuristic
      const pkgName = cfg.packageMap[pkgDirName] ?? `@${pkgDirName}`;
      pkgs.add(pkgName);
    } else {
      hasNonPackageFile = true;
    }
  }

  // Use configurable root tag for non-package files
  if (hasNonPackageFile) {
    pkgs.add(cfg.rootTag);
  }

  return [...pkgs].sort();
}

/**
 * Fallback: extract packages from commit message @scope/pkg patterns and PR labels.
 * Uses configurable rootTag when nothing matches.
 */
function fallbackExtractPackages(
  pr: GitHubPRDetail,
  commits: GitHubCommit[],
  cfg: Required<PRChangelogConfig>,
): string[] {
  const pkgs = new Set<string>();

  // From commit subjects: look for @scope/name patterns
  for (const c of commits) {
    const msg = c.commit?.message || '';
    const matches = msg.match(/@[\w-]+\/[\w-]+/g);
    if (matches) {
      for (const m of matches) pkgs.add(m);
    }
  }

  // From PR labels (if they look like package names)
  if (pr.labels) {
    for (const label of pr.labels) {
      if (label.name.startsWith('@')) pkgs.add(label.name);
    }
  }

  // If nothing found at all, use configurable root tag
  if (pkgs.size === 0) {
    pkgs.add(cfg.rootTag);
  }

  return [...pkgs].sort();
}
