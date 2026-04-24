# Release Toolkit

CI-driven release CLI — version detection + changelog generation.

## Quick Start

```bash
pnpm install && pnpm run build
npx @release-toolkit/cli ci --base main
```

## CLI Options

| Option | Default | Description |
|--------|---------|-------------|
| `-b, --base` | `main` | Base branch for diff |
| `-c, --changelog-dir` | `.changelog` | Changelog JSON directory |
| `-o, --output` | `CHANGELOG.md` | Output file |
| `--comment-pr` | `true` | Post PR comment |
| `--plugins` | `emoji-prefix category-group` | Enabled plugins |

## Changelog Format

```json
[{ "type": "feat", "scope": "auth", "subject": "add login", "prNumber": "123" }]
```

### Commit Types

`feat` | `fix` | `docs` | `style` | `refactor` | `perf` | `test` | `build` | `ci` | `chore` | `revert`

## Built-in Plugins

| Plugin | Type | Description |
|--------|------|-------------|
| `emoji-prefix` | LineFormatter | Add ✨🐛📝 emoji by type |
| `category-group` | LogFormatter | Group by Features/Bug Fixes/etc. |
| `markdown-bold` | LineFormatter | Bold scope |

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

## Output Example

```markdown
## v1.2.0 (2026-04-24)

### ✨ **Features**
- ✨ **auth**: add login (#123)

### 🐛 **Bug Fixes**
- 🐛 fix token bug
```

## GitHub Actions

```yaml
- name: Release Check
  run: npx @release-toolkit/cli ci --base main --comment-pr
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Packages

| Package | Description |
|---------|-------------|
| `@release-toolkit/core` | Version diff, changelog engine, plugin system |
| `@release-toolkit/cli` | CLI entry point |
| `@release-toolkit/changelog-presets` | Built-in formatters |
