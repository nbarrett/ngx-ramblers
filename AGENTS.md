# Agent Guide

This document provides guidance for AI/code assistants working in this repository. It replaces the previous CLAUDE.md and is LLM‑agnostic.

## Project Overview

NGX‑Ramblers is an Angular‑based website framework for local Ramblers groups, with an Express backend and MongoDB Atlas. It provides content management, member management, and walks/events with third‑party integrations.

- Repository: https://github.com/nbarrett/ngx-ramblers
- Project Board: https://github.com/users/nbarrett/projects/1
- Hosting: Fly.io (multiple group instances)
- Architecture: Angular frontend + Node/Express backend

## Common Commands

```
# Frontend dev
npm run serve

# Frontend build
npm run build

# Tests
npm run test           # Frontend (headless)
npm run test:server    # Server (mocha)

# Lint
npm run lint
npm run lintfix

# Clean + reinstall
npm run clean
npm run reinstall

# Deploy (from server/)
npm run deploy
# Manage Fly.io configs
npm run manage-configs
```

## Paths of Interest

- Frontend: `projects/ngx-ramblers/src/app/`
- Backend: `server/`
- Styles: `projects/ngx-ramblers/src/app/assets/styles/`

## Frontend Testing

- Karma + Jasmine (Angular 20)
- Headless by default in CI: `npm run test`

## Backend Testing

- Mocha + Serenity‑JS (only Mocha used for unit tests in automation)
- Run unit tests: `npm run test:server`

## Styling Principles

- Tokens in `assets/styles/tokens.sass` for spacing, radii, buttons, focus ring, modal paddings.
- Buttons: use `assets/styles/buttons.sass`; maintain `--btn-min-height ≥ 40px`.
- Focus: unified focus ring in `assets/styles/focus.sass`.
- Modals: header/footer spacing + title clamp via tokens; close button alignment in `assets/styles/legacy.sass`.
- Input groups: attached edges flattened; consistent heights.
- Navbar: desktop tabs right‑aligned; never wrap at any width; small expanded menu centered.

## Git Hooks (Pre‑Push tests)

- Pre‑push hook runs tests when pushing to `main` or `pre-main`.
- Location: `scripts/githooks/pre-push`
- Enable once:
  - `git config core.hooksPath scripts/githooks`
  - `chmod +x scripts/githooks/pre-push`
- Behavior:
  - Frontend tests: `npm run test`
  - Server tests: `npm run test:server`
  - Skips for other branches; bypass with `git push --no-verify` if needed.

## Notes for Agents

- Prefer minimal, targeted changes; avoid inline code comments in commits unless requested.
- Do not commit workspace/IDE files; follow existing patterns and scripts.
- When modifying server code, compile (`tsc -p server/tsconfig.json`) and run `npm run test:server`.
- When modifying frontend, ensure `npm run test` completes headless.

---

## Appendix: Full Guide (Former CLAUDE.md)

This appendix preserves the detailed guidance previously stored in `CLAUDE.md`.

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NGX-Ramblers is an Angular-based website framework for local Ramblers groups, built with Angular 19, Express.js backend, and MongoDB Atlas. The application provides comprehensive content management, member management, and walks/events organization with third-party integrations.

- **Repository**: https://github.com/nbarrett/ngx-ramblers
- **Project Board**: https://github.com/users/nbarrett/projects/1
- **Deployment Platform**: Fly.io for hosting multiple group instances
- **Architecture**: Full-stack application supporting multiple Ramblers group deployments

## Common Development Commands

```
# Development server
npm run serve

# Production build
npm run build

# Build with stats for analysis
npm run build:stats

# Bundle analysis
npm run analyze

# Linting
npm run lint
npm run lintfix

# Testing
npm run test

# End-to-end testing
npm run e2e

# Clean and reinstall dependencies
npm run clean
npm run reinstall

# Deployment to Fly.io (from server directory)
npm run deploy

# Manage deployment configurations
npm run manage-configs
```

## Architecture Overview

### Frontend Structure
- **Angular Application**: Located in `projects/ngx-ramblers/src/app/`
- **Modular Architecture**: Feature modules for different aspects (admin, committee, walks, members, etc.)
- **Styling**: SASS-based with Ramblers brand standards
- **Build Configuration**: Uses Angular CLI with custom webpack configuration

### Backend Structure
- **Express Server**: Located in `server/`
- **API Routes**: RESTful APIs for all data operations
- **Third-party Integrations**:
  - Ramblers Walks Manager and Insighthub
  - Mailchimp/Brevo for email campaigns
  - AWS S3 for media storage
  - MongoDB Atlas for data persistence
  - Instagram, Facebook, Meetup integrations
  - Google Maps and postcodes.io for geocoding

### Key Directories
- `projects/ngx-ramblers/src/app/`: Main Angular application
- `server/lib/`: Backend business logic organized by service
- `server/lib/mongo/`: Database models and controllers
- `server/lib/brevo/`: Email service integration
- `server/lib/mailchimp/`: Legacy email service integration
- `server/lib/ramblers/`: Ramblers API integrations
- `server/lib/meetup/`: Meetup platform integration

### Development Setup
- **Node.js Management**: Uses nvm (Node Version Manager) to manage Node.js versions
- Node.js v22.19.0, npm 10.9.3 (as specified in package.json engines)
- Angular 20 with TypeScript 5.9.x
- MongoDB for data storage
- AWS S3 for media/asset storage

### Testing Framework
- Karma + Jasmine for unit tests
- Serenity-JS for end-to-end testing (located in `server/lib/serenity-js/`)

### Build Process
1. Angular build outputs to `dist/ngx-ramblers/`
2. Server dependencies installed via `npm run postbuild`
3. Proxy configuration in `projects/ngx-ramblers/proxy.config.json` for development

## Key Technical Notes

- The project uses a monorepo structure with both frontend and backend code
- Server-side code includes both TypeScript source and compiled JavaScript in `server/ts-gen/`
- Angular project is configured with SASS preprocessing and custom webpack setup
- Third-party dependencies include extensive integrations with walking/outdoor activity platforms
- Bootstrap 4.6.2 and ngx-bootstrap for UI components
- Leaflet for mapping functionality
- File uploads handled via ng2-file-upload with AWS S3 backend

## Angular 19 Best Practices

### Component Architecture
- **Standalone Components**: Use standalone components with explicit imports
```
@Component({
  selector: "app-example",
  templateUrl: "./example.component.html",
  styleUrls: ["./example.component.sass"],
  imports: [CommonModule, FormsModule, ComponentDependencies]
})
```

### Dependency Injection
- **Function-based injection**: Use `inject()` function over constructor injection
```
export class ExampleComponent {
  private logger: Logger = inject(LoggerFactory).createLogger("ExampleComponent", NgxLoggerLevel.ERROR);
  pageService = inject(PageService);
  private subscriptions: Subscription[] = [];
}
```

### Subscription Management
```
ngOnInit() {
  this.subscriptions.push(
    this.service.events().subscribe(data => this.handleData(data))
  );
}

ngOnDestroy(): void {
  this.subscriptions.forEach(subscription => subscription.unsubscribe());
}
```

### Logging Standards
- **Custom Logger Wrapper**: Always use LoggerFactory service with consistent class naming
```
private logger: Logger = inject(LoggerFactory).createLogger("ComponentName", NgxLoggerLevel.ERROR);
```

### Testing Guidelines
- **Framework**: Jasmine + Karma with Angular testing utilities
- **Setup**: Use TestBed.configureTestingModule with proper providers
- **HTTP Testing**: Use provideHttpClientTesting for HTTP mocking
- **Logger Testing**: Include LoggerTestingModule in test imports
- **Test Structure**: Describe blocks for method grouping, descriptive test names

### Performance Optimization
- **Lazy Loading**: Implement for feature modules and large components
- **trackBy Functions**: Use for ngFor with dynamic lists to optimize DOM updates
- **Change Detection**: Minimal OnPush usage - default change detection preferred
- **Bundle Analysis**: Use `npm run build:stats` and `npm run analyze` for bundle optimization

### State Management
- **RxJS Services**: Extensive use of BehaviorSubject and Subject for state management (290+ occurrences)
- **Service-based Communication**: Prefer services with RxJS over complex state management
- **Event Broadcasting**: Use BroadcastService for cross-component communication

### File Organization
- **Feature-based Structure**: Organize by business domain (admin, committee, walks, social)
- **Co-location**: Keep related files together (component, template, styles, tests)
- **Barrel Exports**: Use index files for clean imports within feature modules

### Styling Approach
- **SASS External Files**: Use `.sass` files for component styles
- **Bootstrap Integration**: Leverage ngx-bootstrap components
- **Ramblers Brand Standards**: Follow established color schemes and typography

### UI Design Principles
- Tokens: Use CSS variables in `projects/ngx-ramblers/src/app/assets/styles/tokens.sass` for spacing, radii, buttons, focus ring, and modal paddings. Prefer tokens over ad‑hoc values.
- Buttons: Use `assets/styles/buttons.sass` defaults. Padding comes from `--btn-pad-*`; maintain `--btn-min-height` ≥ 40px. Don’t override per component unless necessary.
- Focus: Use unified ring from `assets/styles/focus.sass`. Avoid adding component‑level box‑shadows for focus.
- Modals: Header/footer spacing and title sizing are tokenized. Close button alignment handled in `assets/styles/legacy.sass`.
- Input groups: Attached sides are square (buttons/addons/inputs) via rules in `assets/styles/legacy.sass`. Don’t reintroduce rounded corners on attached edges.
- Pagination/pager: Use `.pager-btn` and `assets/styles/pagination.sass` for consistent hover/active styles.
- Accessibility: Maintain AA contrast for text and focus ring; keep touch targets ≥ 40–44px.
- Responsiveness: Ensure headers/footers and controls behave at 320px–1200px without wrapping artefacts or double borders/shadows.
- Centralize styles: Prefer updating shared files (`buttons.sass`, `pagination.sass`, `legacy.sass`, `tokens.sass`, `focus.sass`) rather than scattering overrides.

### UI Audit Checklist (use before merging UI changes)
- Modal titles wrap/truncate cleanly on small screens; close button aligned.
- Button padding/tap target match tokens; states (hover/focus/active) are consistent.
- No double borders/shadows around modal header/body/footer.
- Input groups have flat attached edges; heights align across inputs/buttons.
- Focus ring visible and non‑conflicting with state colors.
- Layout holds at narrow widths; long labels/translations don’t break alignment.

### Form Handling
- **Template-driven Forms**: Primary approach with Angular Forms module
- **Validation**: Implement custom validators for business logic
- **User Experience**: Provide immediate feedback and clear error messages

### Template Syntax
- **Control Flow**: Use Angular 17+ control flow syntax (@if, @for, @switch)
```
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
  @case ("error") {
    <div>Error occurred</div>
  }
  @default {
    <div>Default content</div>
  }
}
```

### Code Style Standards
- **String Delimiters**: Always use double quotes (`"`) rather than single quotes (`'`)
```
// Correct
selector: "app-example"
templateUrl: "./example.component.html"

// Avoid
selector: 'app-example'
templateUrl: './example.component.html'
```
- **No Comments in Code**: Use self-documenting method names instead of comments
```
// Correct - self-documenting method names
private calculateWalkDistanceInMiles(coordinates: Coordinate[]): number {
  return this.convertMetersToMiles(this.sumCoordinateDistances(coordinates));
}

private convertMetersToMiles(meters: number): number {
  return meters * 0.000621371;
}

// Avoid - methods with comments
private calculate(coords: Coordinate[]): number {
  // Convert distance to miles
  return distance * 0.000621371;
}
```

### Security Practices
- **Authentication**: Use JWT tokens with proper interceptors
- **Authorization**: Implement role-based access control
- **Input Sanitization**: Validate all user inputs server and client-side
- **Environment Configs**: Never commit secrets, use environment files

## Development Workflow

### Environment Setup
- **Full Stack Development**: Use environment-specific scripts to start both frontend and backend together
```
# Start staging environment
./non-vcs/app-start-scripts/run.sh ngx-ramblers-staging.sh

# Start EKWG dev environment
./non-vcs/app-start-scripts/run.sh ekwg-dev-2-ekwg-staging.sh

# Other available environments in ./non-vcs/app-start-scripts/
```

### Development Process
When making changes:
1. **Full stack development**: Use `./non-vcs/app-start-scripts/run.sh <environment-script>` to start both frontend and backend
2. **Frontend only**: Use `npm run serve` for frontend development with hot reload (backend runs separately and is proxied)
3. **Always run linting**: `npm run lint` or `npm run lintfix` before committing
4. **Run tests**: `npm run test` for unit tests, `npm run e2e` for integration tests
5. **Verify production build**: `npm run build` to ensure no build errors
6. **Performance check**: Use `npm run analyze` for bundle size analysis when adding new dependencies

### Deployment Process
- **Platform**: All instances deploy to Fly.io
- **Multi-instance Support**: Each Ramblers group gets their own deployment instance
- **Deployment Scripts**: Mature automation available in `server/deploy/`
```
# Deploy to environments (from server directory)
npm run deploy

# Manage deployment configurations
npm run manage-configs
```
- **Deployment Scripts**: Located in `server/deploy/deploy-to-environments.ts` and `server/deploy/manage-configs.ts`

## Assistant Preferences

- Patches: Keep changes minimal and scoped to the request; avoid fixing unrelated issues and follow existing code style and structure.
- UI Conventions: Prefer Bootstrap 5-compatible patterns when editing templates. The `bootstrap4-compat.sass` shim exists only for transitional support and should not be expanded.
- Build/Validation: Prefer targeted TypeScript checks (e.g., `npx tsc -p projects/ngx-ramblers/tsconfig.app.json`). Run full Angular builds on explicit request.
- Change Summaries: Summarize changes concisely in responses with file path references (include line anchors when helpful).
- Code Comments: Do not add comments inside code changes (see “Code Style Standards: No Comments in Code”).

## Bootstrap 5 Migration TODO

- Convert remaining `.custom-control` radios/checkboxes to Bootstrap 5 `.form-check` across app (admin, imports, image list editors).
- Sweep and replace legacy BS4 utilities where present:
  - Badges: `badge-*` → `badge bg-*` (already used in places).
  - Grid gutters: ensure `no-gutters` → `g-0` only.
- Audit templates for any residual `input-group-prepend/append` usage; replace with sibling `.input-group-text` or buttons.
- Validate build with Node ≥ 20.19: `npm run build` and visual QA of walks, admin members, expenses, imports.
- Optional: add automated rg checks to CI for BS4 class names to prevent regressions.
- look at how classes are applied by the projects/ngx-ramblers/src/app/modules/common/dynamic-content components. There are some styling problems there that still need fixing
