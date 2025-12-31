# AI Assistant Guide

This document provides guidance for AI code assistants working in this repository.

## ⚠️ CRITICAL RULES - READ FIRST

These rules MUST be followed in EVERY session without exception:

### 1. NO CODE COMMENTS
- **NEVER add comments to code** - use self-documenting method names instead
- This includes `//`, `/* */`, and any explanatory text in code
- Remove any comments you see during refactoring

### 2. NO AI ATTRIBUTION IN COMMITS
- **NEVER add AI attribution to commit messages**
- This means NO:
  - `🤖 Generated with [Claude Code](https://claude.ai/code)`
  - `Co-Authored-By: Claude <noreply@anthropic.com>`
  - Any similar AI tool attribution lines
- Commits should appear as if written by a human developer

### 3. FILE OPERATIONS
- **Always free to write/edit existing files and create new files** - no confirmation needed
- **NEVER commit or push without being explicitly asked**

### 4. CODE STYLE
- **Always use double quotes** `"` not single quotes `'` for strings
- **No "get" prefixes** on methods (use `user()` not `getUser()`)
- **Follow existing patterns** - don't introduce new approaches

### 5. DRY PRINCIPLE (Don't Repeat Yourself)
- **EVERY request implicitly requires DRY abstractions for maintainability**
- **ALWAYS reuse existing components, services, and utilities** - never duplicate functionality
- **Before implementing ANY feature**:
  1. Search the codebase for existing implementations
  2. Check for similar components, services, or utilities
  3. If found, reuse and enhance rather than duplicate
  4. If similar functionality exists in multiple places, refactor to a shared abstraction first
- **When making changes**:
  - Ask: "Where else is this functionality used?"
  - Update all instances, or better yet, consolidate to a single reusable implementation
  - Look for wrapper components that might be duplicating logic
  - Consider whether the change should be in a core reusable component vs. a specific context
- **Red flags indicating DRY violations**:
  - Copy-pasting code between files
  - Similar logic in multiple components/services
  - Reimplementing existing functionality with slight variations
  - Making the same fix in multiple places
- **Approach**: Every piece of work should leave the codebase more DRY than you found it
- When in doubt, ask: "Does this already exist in the codebase?" and "Can this be shared?"

### 6. DEBUGGING AND LOGGING
- **NEVER use `console.log()` for debugging**
- **Frontend**: Use the existing `Logger` service (injected via `LoggerFactory`)
- **Backend**: Use the existing `debug` module (e.g., `debug(envConfig.logNamespace("component-name"))`)
- **Tests**: Use existing test framework logging or assertions, NOT `console.log()`
- Logging is already comprehensive - use it instead of adding temporary debug statements

### 7. INTERFACES IN MODEL FILES
- **NEVER define interfaces inline in components, services, or other implementation files**
- **ALL interfaces MUST be defined in appropriate model files** (e.g., `system.model.ts`, `group-event.model.ts`, `walk.model.ts`, etc.)
- **When creating new interfaces**:
  1. Identify the appropriate model file based on the domain (system, events, walks, members, etc.)
  2. Add the interface to that model file with a descriptive name
  3. Export the interface so it can be imported where needed
  4. Import the interface in the component/service that uses it
- **Red flags indicating violations**:
  - `interface SomeInterface {` inside a component `.ts` file
  - Inline type definitions that could be reused elsewhere
  - Duplicated type definitions across files
- **Example**:
  - ❌ Bad: `interface SyncStats { ... }` at bottom of `ramblers-settings.ts`
  - ✅ Good: `export interface WalksManagerSyncStats { ... }` in `system.model.ts` and imported in `ramblers-settings.ts`

## Project Overview

NGX‑Ramblers is an Angular‑based website framework for local Ramblers groups, with an Express backend and MongoDB Atlas. It provides content management, member management, and walks/events with third‑party integrations.

- **Repository**: https://github.com/nbarrett/ngx-ramblers
- **Project Board**: https://github.com/users/nbarrett/projects/1
- **Hosting**: Fly.io (multiple group instances)
- **Architecture**: Angular 20 frontend + Node/Express backend + MongoDB Atlas
- **Node.js**: v22.19.0, npm 10.9.3

## Project Structure

### Key Directories
- **Frontend**: `projects/ngx-ramblers/src/app/`
- **Backend**: `server/`
- **Styles**: `projects/ngx-ramblers/src/app/assets/styles/`
- **Server API**: `server/lib/` (organized by service)
- **Database**: `server/lib/mongo/` (models and controllers)
- **Integrations**: 
  - `server/lib/brevo/` (email service)
  - `server/lib/ramblers/` (Ramblers API)
  - `server/lib/meetup/` (Meetup platform)

### Third-party Integrations
- Ramblers Walks Manager and Insighthub
- Mailchimp/Brevo for email campaigns
- AWS S3 for media storage
- Instagram, Facebook, Meetup integrations
- Google Maps and postcodes.io for geocoding

## Important Rules for AI Assistants

### Git workflow rules and Commit Message Policy
**NEVER** add AI assistant attribution lines to commit messages. This includes:
- ❌ `🤖 Generated with [Claude Code](https://claude.ai/code)`
- ❌ `Co-Authored-By: Claude <noreply@anthropic.com>`
- ❌ Any similar AI tool attribution
- Do not include literal escape sequences like `\n` in commit messages. Use real new lines. When scripting commits, pass multiple `-m` flags instead of embedding `\n`.
- Do not commit or push by default but feel free to write to exiting and add any new files without needing to confirm this

### Semantic Commit Conventions
Use [Conventional Commits](https://www.conventionalcommits.org/) format for clear, categorized commit history:

**Format:** `<type>(<scope>): <description>`

**Types:**
- `feat` - New features or enhancements
- `fix` - Bug fixes
- `refactor` - Code restructuring without behavior changes
- `test` - Adding or updating tests
- `docs` - Documentation changes
- `style` - Code formatting, missing semicolons, etc.
- `build` - Build system or dependency changes
- `ci` - Continuous integration changes

**Scopes (common for this project):**
- `social`, `walks`, `committee` - Feature areas
- `ui`, `forms`, `pipes`, `models` - Technical components
- `auth`, `config`, `api` - System areas
- `test`, `docs`, `build` - Supporting areas

**Examples:**
```
feat(social): add event filtering by date range
fix(walks): resolve incorrect distance calculation
refactor(dates): consolidate date formats into single model
test(pipes): add comprehensive EventDatesAndTimesPipe test suite
docs(readme): update installation instructions
```

### Code Style Rules
- **No comments in code**: Use self-documenting method names instead of inline comments
- **Double quotes**: Always use `"` instead of `'` for strings
- **Minimal changes**: Keep patches targeted and scoped to request
- **Follow existing patterns**: Don't introduce new patterns without discussion
- **No imperative loops**: Replace `for`/`while` constructs with declarative array operations (`map`, `reduce`, `filter`, etc.) so that functions remain side-effect free where possible
- **Structured branching**: Prefer explicit `if / else if / else` chains where each branch returns or handles outcomes inline, instead of scattering multiple early returns throughout the method
- **Method naming**: Never prefix methods with "get" - type system conveys that. Use more meaningful terms:
  - ✅ `user()` - returns user
  - ✅ `queryUsers()` - fetches users from database/API
  - ✅ `createUser()` - creates a new user
  - ✅ `defaultContent()` - returns default content
  - ❌ `getUser()` - redundant "get" prefix
  - ❌ `getUserData()` - redundant "get" prefix
- **Use null instead of undefined**: Always use `null` for absence of value, never `undefined`
- **Immutable operations**: Use immutable ES6+ operations and es-toolkit/compat functions instead of mutating arrays/objects as side effects
  - ✅ `const newArray = array.map()` 
  - ✅ `const newMap = map.reduce()`
  - ❌ `array.push()` or `map.set()` when avoidable
- **Functional utilities**: Use es-toolkit/compat functions for comparisons and operations rather than direct primitive or object comparisons
  - ✅ `equals()` from es-toolkit/compat
  - ✅ `isEmpty()`, `isArray()`, `isObject()` etc.
  - ❌ Direct `===` for object comparisons

### Error Handling
- **No empty catches**: Never add `catch {}` or `catch (e) {}` blocks without at least one of:
  - Logging a meaningful message through the appropriate logger, or
  - Returning/falling back to a safe default value
- Prefer small, targeted try/catch blocks close to the failing operation
- When logging errors inside browser evaluation (Puppeteer), capture messages and surface them to the Node logger after evaluation

## Development Commands

```bash
# Development server
npm run serve

# Production build
npm run build

# Build analysis
npm run build:stats
npm run analyze

# Linting
npm run lint
npm run lintfix

# Testing
npm run test           # Frontend (headless)
npm run test:server    # Server (mocha)
npm run e2e           # End-to-end testing

# Clean and reinstall
npm run clean
npm run reinstall

# Deployment (from server/)
npm run deploy
npm run manage-configs

# Release Notes (from server/)
npm run release-notes:interactive  # Interactive TUI mode
npm run release-notes:latest       # Generate for latest commits
npm run release-notes:all           # Generate all missing notes

# Full stack development environment
./non-vcs/app-start-scripts/run.sh <environment-script>
```

## Development Environment

### Full Stack Setup
Use environment-specific scripts to start both frontend and backend:
```bash
# Start staging environment
./non-vcs/app-start-scripts/run.sh ngx-ramblers-staging.sh

# Start EKWG dev environment
./non-vcs/app-start-scripts/run.sh ekwg-dev-2-ekwg-staging.sh
```

### Build Process
1. Angular build outputs to `dist/ngx-ramblers/`
2. Server dependencies installed via `npm run postbuild`
3. Proxy configuration in `projects/ngx-ramblers/proxy.config.json` for development

### Key Technologies
- **Angular 20** with TypeScript 5.9.x
- **Bootstrap 5**
- **SASS** preprocessing with Ramblers brand standards
- **Leaflet** for mapping functionality
- **ng2-file-upload** with AWS S3 backend

## Testing

### Frontend Testing
- **Framework**: Karma + Jasmine (Angular 20)
- **Command**: `npm run test` (headless by default in CI)
- **Setup**: Use TestBed.configureTestingModule with proper providers
- **HTTP Testing**: Use provideHttpClientTesting for HTTP mocking
- **Logger Testing**: Include LoggerTestingModule in test imports

### Backend Testing
- **Framework**: Mocha + Serenity‑JS (only Mocha used for unit tests in automation)
- **Command**: `npm run test:server`

### Git Hooks (Pre‑Push Tests)
- Pre‑push hook runs tests when pushing to `main` or `pre-main`
- **Location**: `scripts/githooks/pre-push`
- **Enable once**:
  - `git config core.hooksPath scripts/githooks`
  - `chmod +x scripts/githooks/pre-push`
- **Behavior**: Frontend tests + server tests; skips for other branches
- **Bypass**: `git push --no-verify` if needed

## Angular Development Patterns

### Component Architecture
Use standalone components with explicit imports:
```typescript
@Component({
  selector: "app-example",
  templateUrl: "./example.component.html",
  styleUrls: ["./example.component.sass"],  // For shared/reusable styles
  // OR preferably
  styles: [`
    .component-specific {
      /* Use inline styles for single-use, component-specific styling */
    }
  `],
  imports: [CommonModule, FormsModule, ComponentDependencies]
})
```

**Styling Guidelines:**
- **Inline styles first**: Use `styles: [...]` for component-specific CSS used only once
- **External SASS files**: Use `styleUrls: [...]` for shared styles or complex styling that benefits from SASS features
- **Avoid global styles**: Keep component styles scoped to avoid side effects

### Dependency Injection
Use `inject()` function over constructor injection:
```typescript
export class ExampleComponent {
  private logger: Logger = inject(LoggerFactory).createLogger("ExampleComponent", NgxLoggerLevel.ERROR);
  pageService = inject(PageService);
  private subscriptions: Subscription[] = [];
}
```

### Subscription Management
```typescript
ngOnInit() {
  this.subscriptions.push(
    this.service.events().subscribe(data => this.handleData(data))
  );
}

ngOnDestroy(): void {
  this.subscriptions.forEach(subscription => subscription.unsubscribe());
}
```

### Input Change Handling
Prefer lifecycle-specific input setters over `OnChanges`:
```typescript
// Preferred approach
@Input() set pageContent(value: PageContent | null) {
  if (value) {
    this.initializeWithPageContent(value);
  }
}

// Avoid generic OnChanges when possible
// OnChanges should only be used when multiple inputs need coordinated handling
```

### Template Syntax
Use Angular 17+ control flow syntax:
```typescript
// Preferred modern syntax
@if (condition) {
  <div>Conditional content</div>
}

@for (item of items; track item.id) {
  <div>{{ item.name }}</div>
}

@switch (status) {
  @case ("loading") {
    <div>Loading...</div>
  }
  @default {
    <div>Default content</div>
  }
}
```

### State Management
- **RxJS Services**: Use BehaviorSubject and Subject for state management
- **Service-based Communication**: Prefer services with RxJS over complex state management
- **Event Broadcasting**: Use BroadcastService for cross-component communication

## UI Design & Styling

### Styling Principles
- **Tokens**: Use CSS variables in `assets/styles/tokens.sass` for spacing, radii, buttons, focus ring, modal paddings
- **Buttons**: Use `assets/styles/buttons.sass`; maintain `--btn-min-height ≥ 40px`
- **Focus**: Unified focus ring in `assets/styles/focus.sass`
- **Modals**: Header/footer spacing + title clamp via tokens; close button alignment in `assets/styles/legacy.sass`
- **Input groups**: Attached edges flattened; consistent heights
- **Navbar**: Desktop tabs right‑aligned; never wrap at any width; small expanded menu centered

### UI Guidelines
- **Accessibility**: Maintain AA contrast for text and focus ring; keep touch targets ≥ 40–44px
- **Responsiveness**: Ensure components work at 320px–1200px without wrapping artifacts
- **Centralization**: Prefer updating shared files over component-specific overrides

### Form Handling
- **Template-driven Forms**: Primary approach with Angular Forms module
- **Validation**: Implement custom validators for business logic
- **User Experience**: Provide immediate feedback and clear error messages

## Development Workflow

### Making Changes
1. **Full stack**: Use `./non-vcs/app-start-scripts/run.sh <environment-script>`
2. **Frontend only**: Use `npm run serve` (backend proxied)
3. **Always lint**: `npm run lint` or `npm run lintfix` before committing
4. **Run tests**: `npm run test` and `npm run test:server`
5. **Verify build**: `npm run build` to ensure no build errors
6. **Performance check**: Use `npm run analyze` when adding dependencies

### Deployment
- **Platform**: Fly.io (multiple group instances)
- **Commands**: `npm run deploy` and `npm run manage-configs` (from server/)
- **Scripts**: Located in `server/deploy/`

### Release Notes Automation
- **Location**: `server/lib/release-notes/`
- **Purpose**: Automatically generate and publish release notes to the CMS
- **Commands** (from server/):
  - `npm run release-notes:interactive` - Interactive TUI for selecting releases
  - `npm run release-notes:latest` - Generate for commits since last tag
  - `npm run release-notes:all` - Generate all missing release notes
  - `npm run release-notes -- --since <commit> --dry-run` - Preview changes
- **Features**:
  - Parses conventional commits and groups by type
  - Generates user-friendly markdown summaries
  - Authenticates with CMS using JWT
  - Creates/updates pages at `/how-to/committee/release-notes`
  - Updates index page with links to new entries
  - Tracks processed commits to avoid duplicates
- **Configuration**: Set `CMS_USERNAME` and `CMS_PASSWORD` environment variables
- **Documentation**: See `server/lib/release-notes/README.md` for full details

## Bootstrap 5 Migration

### Current Status
Project is migrating from Bootstrap 4 to Bootstrap 5. The `bootstrap4-compat.sass` shim exists for transitional support only.

### Remaining Tasks
- Convert `.custom-control` radios/checkboxes to Bootstrap 5 `.form-check` patterns
- Replace legacy utilities:
  - Badges: `badge-*` → `badge bg-*`
  - Grid gutters: `no-gutters` → `g-0`
- Audit for `input-group-prepend/append` usage; replace with sibling `.input-group-text`
- Fix styling issues in `projects/ngx-ramblers/src/app/modules/common/dynamic-content` components
- Validate build and visual QA across all sections

### Guidelines
- Prefer Bootstrap 5-compatible patterns when editing templates
- Don't expand the compatibility shim - migrate components instead

## Summary for AI Assistants

When working on this project:

1. **Remember the commit message rule**: Never add AI attribution lines
2. **Follow existing patterns**: Use double quotes, no code comments, minimal changes
3. **Test thoroughly**: Run both frontend and backend tests before pushing
4. **Use the development environment**: Leverage the provided scripts for full-stack development
5. **Respect the architecture**: This is a mature Angular 20 application with established patterns
6. **Focus on Bootstrap 5**: When touching UI, migrate away from Bootstrap 4 patterns

The project has comprehensive tooling and established workflows - work with them, not against them.
