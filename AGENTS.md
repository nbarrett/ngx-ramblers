# AI Assistant Guide

## Critical Rules

1. **NEVER commit or push without explicit instruction** - make file changes freely, but `git commit` and `git push` each require the user to explicitly ask for that specific action. Do not anticipate, chain, or assume the next step. Pattern-matching on previous flows is not permission.
2. **No code comments** - no `//` or `/* */`. Use self-documenting names. Remove comments during refactoring
3. **No AI attribution in commits** - no `Co-Authored-By`, no `Generated with`, nothing. A `commit-msg` hook enforces this
4. **No `console.log()`** - Frontend: use `Logger` via `LoggerFactory`. Backend: use `debug` module
5. **Interfaces in model files only** - never define inline in components/services
6. **DRY** - always search for existing implementations before writing new code. Reuse and enhance, never duplicate

## Project Overview

- **Architecture**: Angular 20 + Node/Express + MongoDB Atlas, hosted on Fly.io
- **Repository**: https://github.com/nbarrett/ngx-ramblers
- **Node.js**: v24.14.0, npm 11.9.0
- **Frontend**: `projects/ngx-ramblers/src/app/`
- **Backend**: `server/` (TypeScript only, never `.js`)
- **Styles**: `assets/styles/` (tokens, buttons, focus, legacy)
- **Database**: `server/lib/mongo/`
- **Integrations**: `server/lib/brevo/`, `server/lib/ramblers/`, `server/lib/meetup/`

## Code Style

- **Double quotes** always, never single quotes
- **No "get" prefixes** on methods (`user()` not `getUser()`)
- **`null` not `undefined`** for absence of value
- **`T[]` not `Array<T>`**
- **Immutable operations** - prefer `map`/`reduce`/`filter` over mutation
- **Structured branching** - prefer `if/else if/else` over scattered early returns
- **UK English** in commits and docs ("centralised", "colour", "behaviour")
- **Minimal changes** - keep patches targeted and scoped

## ESLint-Enforced Bans

These cause build failures - use the listed replacements:

| Banned | Use instead |
|--------|------------|
| `new Date()` / `Date.now()` | Backend: `dateTimeNow()` from `server/lib/shared/dates.ts`. Frontend: `this.dateUtils.dateTimeNow()` |
| `Object.keys/values/entries()` | `keys/values/entries()` from `es-toolkit/compat` |
| `typeof x === "string"` (etc.) | `isString/isNumber/isBoolean/isObject/isUndefined()` from `es-toolkit/compat` |
| `Array.isArray()` | `isArray()` from `es-toolkit/compat` |
| `for` / `while` / `for...in` loops | `map()`, `reduce()`, `filter()`, `forEach()`. `for...of` is allowed |
| Inline comments (`//`) | Self-documenting code |

## Git Workflow

- **Conventional commits**: `<type>(<scope>): <description>` (feat, fix, refactor, test, docs, style, build, ci)
- **Trunk-based development** - all work directly on main. Never create branches or worktrees unilaterally. The only exception is Claude Swarm, which creates worktrees as part of a multi-ticket session.
- **No literal `\n`** in commit messages - use real newlines or multiple `-m` flags
- **Hook setup**: `npm run setup:hooks`

## Deployment Dialect

When the user asks to commit and push, use this domain language to determine deployment scope:

| User says | What to do |
|-----------|------------|
| "commit and push" / "push to staging" / nothing about deployment | Normal commit — staging only (default CI behaviour) |
| "deploy to all environments" / "deploy everywhere" / "deploy to all" / "full deploy" | Push normally, then wait for the main build workflow to succeed and trigger `deploy-to-environments.yml` for `all` environments using the successful build run number as `image_tag` |

**How full deploy works:**
- Never encode deployment scope in the commit message
- Push the commit to `main`
- Wait for `build-push-and-deploy-ngx-ramblers-docker-image.yml` to complete successfully for that pushed commit
- Trigger `deploy-to-environments.yml` with `environments=all` and `image_tag=<successful build run number>`
- For terminal-driven flows, `npm run push` prompts for this on `main`
- For agent-driven flows, use `npm run push -- --deploy-all-after-build` or the equivalent `gh` workflow dispatch sequence

**Never guess** — if the user's intent is ambiguous, ask: "Deploy to staging only, or all environments?"

### Branching
- **No pull requests**: This project commits directly to `main`
- **No feature branches**: Unless explicitly requested for worktree-based parallel work
- **Worktrees**: When used, cherry-pick the result onto `main` and clean up the worktree/branch
- **Never use `EnterWorktree` in `@annix/claude-swarm` worktrees**: If `@annix/claude-swarm` has already placed this session in a worktree (branch starts with `claude/`), never use the `EnterWorktree` tool — just work directly on the current branch. `@annix/claude-swarm` manages the worktree lifecycle; creating a nested worktree puts commits on the wrong branch.


## Amend vs New Commit

When fixing a problem discovered after committing:

| Situation | Action |
|-----------|--------|
| Pre-commit hook blocked the commit (lint on staged files failed) | Fix, re-stage, `git commit --amend` |
| Pre-push hook blocked the push (full lint or tests failed) | Fix, re-stage, `git commit --amend` — commit never reached remote |
| Push succeeded but CI or staging deploy failed | New commit — the original is already on remote; amending would rewrite public history |

## Error Handling

- No empty catch blocks - always log or return a safe default
- Prefer small, targeted try/catch blocks

## Angular Patterns

- **Standalone components** with explicit imports
- **`inject()` function** over constructor injection
- **Logger**: `inject(LoggerFactory).createLogger("Name", NgxLoggerLevel.ERROR)`
- **Subscriptions**: push to `subscriptions[]` array, unsubscribe in `ngOnDestroy`
- **Input setters** over `OnChanges` when handling a single input
- **Angular 17+ control flow**: `@if`, `@for (track item.id)`, `@switch`
- **Styling**: inline `styles:` for single-use CSS, `styleUrls:` for shared SASS
- **State**: RxJS BehaviorSubject/Subject in services, BroadcastService for cross-component

## UI & Styling

- Use CSS variables from `tokens.sass` for spacing, radii, buttons
- Button min height >= 40px, touch targets >= 40-44px
- Bootstrap 5 patterns (migrating from BS4 - don't expand `bootstrap4-compat.sass`)
- Alert types: `alert-danger` (errors), `alert-warning` (missing config/action needed), `alert-success` (confirmations). Never use `alert-info`
- Template-driven forms with custom validators

## Testing

- **Frontend**: `npm run test` (Karma + Jasmine). Use `provideHttpClientTesting`, `LoggerTestingModule`
- **Backend**: `npm run test:server` (Mocha)
- Pre-push hook runs tests for `main`/`pre-main` branches

## Commands

```bash
npm run serve              # Frontend dev server
npm run build              # Production build
npm run lint / lintfix     # Linting
npm run test               # Frontend tests
npm run test:server        # Backend tests
./bin/ngx-cli local dev <env>  # Full stack (staging, ashford, ekwg, etc.)
npm run push               # git push with optional all-environments deploy prompt (terminal use)
npm run deploy             # Deploy (from server/)
npm run release-notes:interactive  # Release notes (from server/)
```
