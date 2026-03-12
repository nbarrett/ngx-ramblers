# Git Hooks

This directory contains git hooks that enforce project standards.

## Installation

Hooks are centralised in `.githooks/` and activated by git via:
```bash
git config core.hooksPath .githooks
```

## Available Hooks

### pre-commit
Lints only the staged `.ts` and `.html` files before the commit is recorded. Fast — surfaces lint errors in seconds without waiting for the full test suite.

**Behaviour:**
- Skips silently if no `.ts`/`.html` files are staged
- Fails immediately if any staged file has a lint error
- Does not run tests — that is pre-push's job

### commit-msg
Prevents AI attribution in commit messages to enforce the "NO AI ATTRIBUTION" rule from AGENTS.md.

**Blocked patterns:**
- `Co-Authored-By: Claude`
- `🤖 Generated with`
- `noreply@anthropic.com`
- `Claude Code`
- etc.

**Example of blocked commit:**
```
feat(walks): add new search feature

Co-Authored-By: Claude Sonnet <noreply@anthropic.com>
```

**This will be rejected with:**
```
❌ COMMIT REJECTED: AI attribution detected in commit message
```

### pre-push
Runs the test suite when pushing to `main` or `pre-main`.

**Behaviours:**
- Blocks the push if tests fail.
- Skips for other branches.

## Optional Post-Push Deployment

Git has no native `post-push` hook. Use `npm run push` instead of `git push` when on `main` to get an interactive prompt after the push succeeds:

```
Deploy to all environments? [y/N]
```

If you answer `y`, it triggers the "Deploy to Selected Environments" GitHub Actions workflow with `environments=all image_tag=latest`. The build workflow must complete before the deploy actually deploys.

## How It Works

1. Hooks live in `.githooks/` (tracked by git).
2. Git uses `core.hooksPath` to run them directly from this directory.
3. Git automatically runs these hooks at the appropriate time.

## Bypassing Hooks (Not Recommended)

If absolutely necessary, you can bypass hooks with:
```bash
git commit --no-verify
```

**However, this violates project standards and should not be used.**
