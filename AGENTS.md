# AI Assistant Guide

## Critical Rules

1. **NEVER commit or push without explicit instruction** - make file changes freely, but `git commit` and `git push` each require the user to explicitly ask for that specific action. Do not anticipate, chain, or assume the next step. Pattern-matching on previous flows is not permission.
2. **No code comments** - no `//` or `/* */`. Use self-documenting names. Remove comments during refactoring
3. **No AI attribution in commits** - no `Co-Authored-By`, no `Generated with`, nothing. A `commit-msg` hook enforces this
4. **No `console.log()`** - Frontend: use `Logger` via `LoggerFactory`. Backend: use `debug` module
5. **Interfaces in model files only** - never define inline in components/services
6. **DRY** - always search for existing implementations before writing new code. Reuse and enhance, never duplicate
7. **Never write "blacklist" or "whitelist"** (any form) in prose, tickets, commits, UI, or our identifiers. Prefer **deny / denied / deny list**, **allow / allowed / allow list**, or **block / blocked / suppressed** as fits. Third-party/wire API names (e.g. Brevo `emailBlacklisted`, Tagify `whitelist`) only at the mapping call site.

## Project Overview

- **Architecture**: Angular 21 + Node/Express + MongoDB Atlas, hosted on Fly.io
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
- **Structured branching** - `if` / `else if` / `else` or one expression; no early-return / guard-clause style (enforced by `ngx/no-early-return`)
- **UK English** in commits and docs ("centralised", "colour", "behaviour")
- **Minimal changes** - keep patches targeted and scoped

## ESLint-Enforced Bans

These cause build failures - use the listed replacements:

| Banned | Use instead |
|--------|------------|
| `new Date()` / `Date.now()` | Backend: `dateTimeNow()` from `server/lib/shared/dates.ts`. Frontend: `this.dateUtils.dateTimeNow()` |
| `Object.keys/values/entries()` | `keys()`/`values()`/`toPairs()` from `es-toolkit/compat` (note: the entries equivalent is `toPairs`, not `entries`) |
| `typeof x === "string"` (etc.) | `isString/isNumber/isBoolean/isObject/isUndefined()` from `es-toolkit/compat` |
| `Array.isArray()` | `isArray()` from `es-toolkit/compat` |
| `for` / `while` / `for...in` loops | `map()`, `reduce()`, `filter()`, `forEach()`. `for...of` is allowed |
| `let` | `const` only. For a changing counter or accumulator, use a `const` object (e.g. `const progress = {completed: 0}`) or return a new value from `map`/`reduce`/`filter` |
| Inline comments (`//`) | Self-documenting code |
| Early return / guard `if (x) return` without `else` | Structured `if` / `else if` / `else`, or one expression (`ngx/no-early-return`, baseline-backed) |

Existing early-return sites are listed in `.eslint-baselines/no-early-return.json` so lint stays green. **New** early returns fail lint. After removing legacy ones, shrink the baseline with `npm run lint:baseline:early-return`.

## Git Workflow

- **Conventional commits**: `<type>(<scope>): <description>` (feat, fix, refactor, test, docs, style, build, ci)
- **Compound types and scopes** join with `+` when a commit genuinely spans several: `perf+fix(server+admin): ...`
- **Ticket references**: the subject line ends with `(ref #NNN)`, or `(ref #NNN, #MMM)` for multiple tickets. Never mention external contacts or partner names in commit messages or GitHub issues - describe the scenario generically.
- **Commit bodies are Markdown** for every feat/fix/perf commit (release notes are generated from them via `npm run release-notes`, so write them for members reading the site's Release Notes pages). Use this exact structure, with a blank line after each heading and before each list:
  - `## What's new` - a plain-English narrative paragraph of what changed and why it matters
  - `## At a glance` - user-facing bullet points, one behaviour change each
  - `## Technical changes` - implementation bullets for developers
- **Markdown formatting in commit bodies**: wrap code identifiers, filenames, paths, commands, endpoints, configuration keys and literal technical values in backticks. Use `-` for unordered lists. Do not flatten headings into plain text.
- **Verify the stored message after every commit, amend or rebase** with `git log -1 --format=%B`. Git's default editor cleanup can remove Markdown headings beginning with `#`; when an editor is involved, use a cleanup mode that preserves them or commit from a message file, then confirm all three headings remain in the stored message.
- **Trunk-based development** - all work directly on main. Never create branches or worktrees unilaterally. The only exception is Claude Swarm, which creates worktrees as part of a multi-ticket session.
- **No literal `\n`** in commit messages - use real newlines or multiple `-m` flags
- **Never hard-wrap commit message bodies.** Each paragraph is one unbroken line, and each list item is one unbroken line, however long. Do not wrap at 72, 80 or any other column. A newline inside a paragraph is a soft line break: release notes are generated from these bodies via `npm run release-notes` and rendered as Markdown, where mid-paragraph breaks corrupt the output. Let the terminal and the renderer wrap it. Check before committing with `git log -1 --format=%B | awk 'length > 0 && length < 95 && $0 !~ /^[-#]/'` - any prose line it prints that is not a heading or a short standalone sentence is a wrapped paragraph and must be joined
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

## Backend / Express Patterns

- **Routes are declarative** - a `*-routes.ts` file maps `path + verb` to middleware and named handler functions, nothing else. No inline `(req, res) => {...}` handlers, no branching, no response building, and no `multer`/config wiring in the route. Put the logic in a named, exported function in the matching controller/handler module (`*-controllers.ts`, or the feature module e.g. `file-upload.ts`) and reference it by name.
  - Bad: `router.post("/x", (req, res) => { if (bad) { res.status(400).json(...) } })`
  - Good: `router.post("/x", authenticate(), receiveUpload, handleX)` with `receiveUpload`/`handleX` exported from the controller module.
- Not yet ESLint-enforced: ~50 legacy inline handlers across 10 `*-routes.ts` files predate this rule. New or touched routes must follow it; the backlog needs a dedicated refactor before an `error`-level lint rule can be switched on.

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
- **Inline alerts always have an icon and a title**: use `d-flex align-items-start` with a Font Awesome icon (`faCircleExclamation` for warning/danger, `faCircleCheck` for success) and a bold title on its own line (or `strong` before the message). Do not ship bare text-only alert boxes. Prefer the same pattern as NotifierService alerts: icon + **title** + body
- Template-driven forms with custom validators

### Date and time formatting (mandatory)

Never invent date format strings such as `"yyyy-MM-dd HH:mm"`, `"dd/MM/yyyy"`, or `"yyyyMMdd-HHmm"`. Always use a member of the enums in `projects/ngx-ramblers/src/app/models/date-format.model.ts`:

| Enum | Use for |
|------|---------|
| `UIDateFormat` | App UI, admin copy, filenames, logs, API display strings, server-generated documents |
| `RamblersWalksManagerDateFormat` | Walks Manager CSV/API interchange only |
| `RamblersInsightHubDateFormat` | Insight Hub / Salesforce date fields only |
| `BsDatepickerFormat` | Bootstrap datepicker input masks only |

**How to format:**

- **Frontend:** `DateUtilsService` helpers (`displayDate`, `displayDateAndTime`, `displayDateAbbreviatedTime`, …) or `asString(value, inputFormat, UIDateFormat.…)` / pipes such as `displayDateAndTime`
- **Backend:** `formatDateTime(dateTime, UIDateFormat.…)` from `server/lib/shared/dates.ts`, or `dateTime.toFormat(UIDateFormat.…)`
- **Default human-readable date+time:** `UIDateFormat.DISPLAY_DATE_AND_TIME` (e.g. `Thursday, 8 August 2026, 1:11:00 pm`)
- **Default file stamp:** `UIDateFormat.FILE_TIMESTAMP_COMPACT`
- Zone is **Europe/London** via `dateTimeNow()` / `DateUtilsService` — do not hand-roll `toUTC().toFormat("yyyy-MM-dd …")` for user-visible strings

### Buttons (mandatory — 100% Ramblers theme)

Every button is **filled** with a Ramblers palette colour. Never Bootstrap default blue. Never outline/ghost buttons for ordinary actions. Classes live in `projects/ngx-ramblers/src/app/assets/styles/buttons.sass`.

| Role | Class | Appearance |
|------|--------|------------|
| **Default** — normal actions and main CTAs | `btn btn-primary` | Filled sunrise yellow, black text |
| Not the default — secondary, cancel, refresh, peers next to a primary | `btn btn-quiet` | Filled grey; hover and active go sunrise |
| Destructive confirm | `btn btn-danger` | Only when the project styles it (verify in `buttons.sass`) |
| Success confirm | `btn btn-success` | Mintcake filled (already themed) |

**Default is `btn-primary`.** Use `btn-quiet` only when the control is deliberately not the default action (e.g. Cancel next to Save, Refresh next to Download, extra peers in a button row). Do not make every button quiet by habit.

**Banned (do not introduce in new or touched templates):**

- `btn-outline-primary`, `btn-outline-secondary`, `btn-outline-dark`, `btn-outline-light`, and any other `btn-outline-*` except rare existing CMS patterns already in the codebase
- Raw Bootstrap primary blue (`#0d6efd` or any control that renders blue)
- `btn-info` as a colour choice (it is remapped to sunrise, but prefer `btn-primary` so intent is clear)
- `btn-sunset` / `btn-outline-sunset` unless Nick asks for sunset by name
- Transparent / outline / hover-only buttons for toolbars, download rows, filters, or admin actions

**Rules of thumb:**

1. **Always filled** — solid background in the resting state, not a hollow outline that only fills on hover.
2. **Default = primary** — reach for `btn-primary` first; use `btn-quiet` only when the button is not the default action in that group.
3. **If it looks blue, the class is wrong** — fix to `btn-primary` (or `btn-quiet` if non-default) before shipping.
4. **Copy from a nearby admin screen** that already uses the correct filled classes rather than inventing Bootstrap class combinations.

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
