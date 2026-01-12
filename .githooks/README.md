# Git Hooks

This directory contains git hooks that enforce project standards.

## Installation

Hooks are **automatically installed** during `npm install` via the `postinstall` script.

To manually install hooks:
```bash
npm run setup:hooks
```

## Available Hooks

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

## How It Works

1. Hooks are stored in `.githooks/` (tracked by git)
2. During `npm install`, hooks are copied to `.git/hooks/` (not tracked)
3. Git automatically runs these hooks at the appropriate time

## Bypassing Hooks (Not Recommended)

If absolutely necessary, you can bypass hooks with:
```bash
git commit --no-verify
```

**However, this violates project standards and should not be used.**
