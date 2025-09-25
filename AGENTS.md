# AI Assistant Guide

This document provides guidance for AI code assistants working in this repository.

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
- **Minimal changes**: Keep patches targeted and scoped to the request
- **Follow existing patterns**: Don't introduce new patterns without discussion

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
