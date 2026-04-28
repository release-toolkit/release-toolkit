# Release Toolkit

CI-driven release CLI for monorepos — version detection, changelog generation, PR change tracking, git tags, and GitHub Releases.

## Commands

```
release <command> [options]

Commands:
  ci              Full CI pipeline: detect → changelog → write → tag → release
  preview         Generate release preview and post as PR comment (no side effects)
  init            Initialize .releasetoolkit/config.json (idempotent)
  pr-changelog    PR-level changelog operations
    fetch         Fetch PR data from GitHub, render & save changelog
    list          List saved PR changelogs
```

## Quick Start

```bash
# 1. Install & build
pnpm install && pnpm run build

# 2. Initialize config (optional — zero-config works with sensible defaults)
npx @release-toolkit/cli init

# 3. Run in CI (two separate commands, see GitHub Actions section)
npx @release-toolkit/cli preview   # PR preview: post comment only
npx @release-toolkit/cli ci        # Publish: full release pipeline

# 4. PR changelog (standalone, outside CI)
npx @release-toolkit/cli pr-changelog fetch --pr-number 42 --save
```

---

## Authentication (Token)

All GitHub API calls require a token. There are **two ways** to provide it:

### Method 1: Environment Variable (recommended)

Set `GITHUB_TOKEN` — this works everywhere and is the default source:

| Component | How it reads token |
|-----------|-------------------|
| `release ci` | Auto-reads `process.env.GITHUB_TOKEN` via `GithubContextDetector` |
| `release preview` | Same as above |
| `pr-changelog fetch` | Falls back to `GITHUB_TOKEN` when `--token` is omitted |

**In GitHub Actions** (no extra config needed):

```yaml
env:
  GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

> `secrets.GITHUB_TOKEN` is automatically available in every GitHub Actions workflow.
> No need to create a PAT or configure repo settings. The token's permissions are
> controlled by the repository's **Settings → Actions → General → Workflow permissions**.

### Method 2: CLI Flag

For local testing or non-GitHub-Actions environments:

```bash
release pr-changelog fetch --pr-number 42 \
  --owner myorg --repo myrepo \
  --token ghp_xxxxxxxxxxxx
```

### Token Permissions Required

| Permission Scope | Needed For |
|------------------|-------------|
| `contents: write` | Pushing git tags, writing CHANGELOG.md |
| `pull-requests: write` | Posting/updating PR comments |
| `releases: write` | Creating GitHub Releases |

---

## `ci` — Full CI Pipeline

Complete release pipeline: version detection → changelog → write file → git tags → GitHub Release → hooks.

Intended for use **after PR merge** (e.g. `on: push` to main).

```bash
release ci                              # full pipeline
release ci --base dev                   # compare against 'dev' branch
release ci --dry-run                   # preview output without side effects
```

### What it does

```
✅ Version detection (package.json diff)
✅ Changelog generation & formatting
✅ Write CHANGELOG.md
✅ Create git tags (@pkg@version)
✅ Create GitHub Release
✅ Run afterRelease hooks
❌ Post PR comment (no PR exists after merge)
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `-b, --base <ref>` | `main` | Base branch/commit for diff |
| `--dry-run` | `false` | Preview output without writing files, creating tags, or posting comments |

### Config File Options

Set in `.releasetoolkit/config.json` (all have sensible defaults):

| Config Key | Default | Description |
|------------|---------|-------------|
| `baseRef` | `main` | Default base branch |
| `changelogDir` | `.changelog` | Changelog JSON directory |
| `outputPath` | `CHANGELOG.md` | Output file path |
| `commentPr` | `true` | Post PR comment (only when run from a PR context) |
| `plugins` | `emoji-prefix`, `category-group`, `markdown-bold` | Enabled plugins |
| `fileWriteMode` | `overwrite` | Write mode for CHANGELOG.md (`append` / `overwrite`) |
| `createTags` | `true` | Create git tags |
| `createRelease` | `true` | Create GitHub Release |
| `afterRelease` | `[]` | Hook scripts to run after each release |

---

## `preview` — PR Release Preview

Generates the release changelog and posts it as a PR comment.
**Does NOT write files, create tags, or publish releases.**

Intended for use **during PR review** (e.g. `on: pull_request`).

```bash
release preview                       # post preview comment on current PR
release preview --dry-run             # preview output without posting
```

### What it does

```
✅ Version detection (package.json diff)
✅ Changelog generation & formatting
✅ Post Release Preview comment on PR
❌ Write CHANGELOG.md
❌ Create git tags
❌ Create GitHub Release
❌ Run afterRelease hooks
```

The PR comment includes:
- Target version + version diff table (Current → Next)
- Full formatted changelog content
- "⚠️ This is a preview" notice

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `--dry-run` | `false` | Preview output without posting PR comment |

---

## `init` — Initialize Config

Creates `.releasetoolkit/config.json` with a minimal template. Safe to re-run (idempotent).

```bash
release init
# ✓ Created .releasetoolkit/config.json
```

Generated template:

```json
{
  "prChangelog": {
    "packagesDir": "packages",
    "rootTag": "root"
  }
}
```

All fields have sensible defaults. Only add fields you want to customize.

---

## `pr-changelog` — PR Change Records

Fetch, render, save, and browse per-PR changelogs. Works independently of the CI pipeline.

### Fetch

Pulls data from GitHub API and renders a Changeset-style markdown:

```bash
# Required: PR number + auth
release pr-changelog fetch --pr-number 123 \
  --owner myorg --repo myrepo --token ghp_xxxx

# Or use env vars (GITHUB_REPOSITORY, GITHUB_TOKEN):
export GITHUB_REPOSITORY="myorg/myrepo"
export GITHUB_TOKEN="ghp_xxxx"
release pr-changelog fetch --pr-number 123

# Save to disk:
release pr-changelog fetch --pr-number 123 --save
release pr-changelog fetch --pr-number 123 --save --skip-if-exists
```

| Option | Description |
|--------|-------------|
| `--pr-number <N>` | *(required)* PR number |
| `--owner <owner>` | GitHub owner/org (fallback: `GITHUB_REPOSITORY`) |
| `--repo <repo>` | Repository name (fallback: `GITHUB_REPOSITORY`) |
| `--token <token>` | GitHub token (fallback: `GITHUB_TOKEN`) |
| `--save` | Save rendered MD to `.releasetoolkit/changelog/prs/` |
| `--skip-if-exists` | Skip if file already exists (implies `--save`) |

#### Package Resolution (3-tier priority)

The `packages[]` list is determined by:

1. **Explicit declaration** in first PR comment: `<!-- PACKAGES: @pkg/a, @pkg/b -->`
2. **Diff inference** — maps changed file paths to packages under `{packagesDir}/`
3. **Fallback** — regex extraction from commit messages + PR labels

Changes outside any package directory are tagged as configurable `rootTag` (default: `"root"`).

#### PR Comment Protocols

**Release log extraction** — wrap content between anchors in the first review comment:

```html
<!-- RELEASE-LOG-START -->
This PR adds the new OAuth flow.
Breaking: removes legacy session API.
<!-- RELEASE-LOG-END -->
```

**Package declaration** — explicitly declare affected packages:

```html
<!-- PACKAGES: @releasetoolkit/core, @releasetoolkit/cli -->
```

#### Output Format (saved file)

Stored at `.releasetoolkit/changelog/prs/pr-{number}_{date}.md`:

```markdown
---
@releasetoolkit/core
root
---

feat(core): add three-tier package resolution
fix(cli): correct bin entry path

This PR adds the new OAuth flow.
```

### List

Browse saved PR changelogs:

```bash
release pr-changelog list                    # list filenames
release pr-changelog list --show-content     # print each file's content
```

### PR Changelog Config

Configure under `prChangelog` key in `.releasetoolkit/config.json`:

| Key | Default | Description |
|-----|---------|-------------|
| `packagesDir` | `"packages"` | Monorepo packages directory name |
| `rootTag` | `"root"` | Tag for changes outside packages |
| `packageMap` | `{}` | Directory-to-name mapping, e.g. `{ "core": "@releasetoolkit/core" }` |

---

## Changelog Format

Input (per-commit JSON):

```json
[{ "type": "feat", "scope": "auth", "subject": "add login", "prNumber": "123" }]
```

Output example:

```markdown
## v1.2.0 (2026-04-24):

### ✨ **Features**

- ✨ **auth**: add login (#123)

### 🐛 **Bug Fixes**

- 🐛 **api**: fix token bug
```

### Commit Types

`feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `build` | `ci` | `chore` | `revert`

### Built-in Plugins

| Plugin | Type | Description |
|--------|------|-------------|
| `emoji-prefix` | LineFormatter | Add ✨🐛📝 emoji by commit type |
| `category-group` | LogFormatter | Group by Features / Bug Fixes / etc. |
| `markdown-bold` | LineFormatter | Bold scope prefix |

### Category Grouping

| Category | Types |
|----------|-------|
| Features | `feat` |
| Bug Fixes | `fix` |
| Performance | `perf` |
| Refactoring | `refactor` |
| Documentation | `docs` |
| Tests | `test` |
| Build & CI | `build`, `ci` |
| Chores | `chore`, `style` |
| Reverts | `revert` |

---

## GitHub Actions Integration

### Recommended: Two-job Setup

```yaml
name: Release

on:
  pull_request:           # Job A: preview on every PR
    branches: [main]
  push:                   # Job B: publish after merge to main
    branches: [main]

permissions:
  contents: write
  pull-requests: write
  id-token: write

jobs:
  # ── Job A: PR Preview ────────────────────────
  preview:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
      - run: pnpm install

      - name: Release Preview
        run: npx @release-toolkit/cli preview
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  # ── Job B: Publish ──────────────────────────
  publish:
    runs-on: ubuntu-latest
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0          # needed for git tag push

      - uses: pnpm/action-setup@v4
      - run: pnpm install

      - name: Publish Release
        run: npx @release-toolkit/cli ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      # Optional: save PR changelog snapshot
      - name: Save PR Changelog
        if: github.event_name == 'push'
        run: |
          npx @release-toolkit/cli pr-changelog fetch \
            --pr-number ${{ github.event.number }} \
            --save
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### Single-job (Simple)

If you prefer one job that runs both, use separate steps with `if` conditions:

```yaml
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
      - run: pnpm install

      - name: Release Preview (PR only)
        if: github.event_name == 'pull_request'
        run: npx @release-toolkit/cli preview
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Publish Release (push only)
        if: github.event_name == 'push'
        run: npx @release-toolkit/cli ci
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## Storage Layout

```
.releasetoolkit/
├── config.json                      # User configuration (created by `release init`)
└── changelog/
    ├── releases/                    # Per-release summaries (generated by `release ci`)
    │   └── v1.2.0_2026-04-24.md
    └── prs/                         # Per-PR change records (generated by `pr-changelog fetch --save`)
        └── pr-42_2026-04-20.md
```

---

## Example Full Config

```json
{
  "baseRef": "develop",
  "outputPath": "CHANGELOG.md",
  "commentPr": true,
  "createTags": true,
  "createRelease": true,
  "plugins": ["emoji-prefix", "category-group"],
  "afterRelease": ["npm publish --registry=..."],
  "prChangelog": {
    "packagesDir": "packages",
    "rootTag": "global",
    "packageMap": {
      "core": "@releasetoolkit/core",
      "cli": "@releasetoolkit/cli"
    }
  }
}
```

---

## Packages

| Package | Description |
|---------|-------------|
| `@release-toolkit/core` | Core engine: version diff, changelog, plugins, config, PR fetcher |
| `@release-toolkit/cli` | CLI entry point — `release` command |
| `@release-toolkit/changelog-presets` | Built-in formatters (emoji, category, bold) |

## License

MIT
