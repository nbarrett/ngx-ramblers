# AI Assistant Guide

## Critical Rules

1. **No code comments** - no `//` or `/* */`. Use self-documenting names. Remove comments during refactoring
2. **No AI attribution in commits** - no `Co-Authored-By`, no `Generated with`, nothing. A `commit-msg` hook enforces this
3. **No `console.log()`** - Frontend: use `Logger` via `LoggerFactory`. Backend: use `debug` module
4. **Interfaces in model files only** - never define inline in components/services
5. **DRY** - always search for existing implementations before writing new code. Reuse and enhance, never duplicate
6. **File ops free, git ops require permission** - never commit or push without explicit user request

## Project Overview

- **Architecture**: Angular 20 + Node/Express + MongoDB Atlas, hosted on Fly.io
- **Repository**: https://github.com/nbarrett/ngx-ramblers
- **Node.js**: v22.19.0, npm 10.9.3
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
- **Cherry-pick over merge** - never use `git merge`. Use `git cherry-pick` or `git rebase`
- **Worktrees** at `../ngx-ramblers-worktrees/<issue-name>/`
- **No literal `\n`** in commit messages - use real newlines or multiple `-m` flags
- **Hook setup**: `npm run setup:hooks`

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
npm run deploy             # Deploy (from server/)
npm run release-notes:interactive  # Release notes (from server/)
```
