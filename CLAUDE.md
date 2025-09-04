# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NGX-Ramblers is an Angular-based website framework for local Ramblers groups, built with Angular 19, Express.js backend, and MongoDB Atlas. The application provides comprehensive content management, member management, and walks/events organization with third-party integrations.

- **Repository**: https://github.com/nbarrett/ngx-ramblers
- **Project Board**: https://github.com/users/nbarrett/projects/1
- **Deployment Platform**: Fly.io for hosting multiple group instances
- **Architecture**: Full-stack application supporting multiple Ramblers group deployments

## Common Development Commands

```bash
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
- Node.js v20.19.4, npm 10.8.2 (as specified in package.json engines)
- Angular 19 with TypeScript 5.7.3
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
  ```typescript
  @Component({
    selector: "app-example",
    templateUrl: "./example.component.html",
    styleUrls: ["./example.component.sass"],
    imports: [CommonModule, FormsModule, ComponentDependencies]
  })
  ```

### Dependency Injection
- **Function-based injection**: Use `inject()` function over constructor injection
  ```typescript
  export class ExampleComponent {
    private logger: Logger = inject(LoggerFactory).createLogger("ExampleComponent", NgxLoggerLevel.ERROR);
    pageService = inject(PageService);
    private subscriptions: Subscription[] = [];
  }
  ```

### Subscription Management
- **Manual subscription arrays**: Track subscriptions in arrays and clean up in ngOnDestroy
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

### Logging Standards
- **Custom Logger Wrapper**: Always use LoggerFactory service with consistent class naming
  ```typescript
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

### Form Handling
- **Template-driven Forms**: Primary approach with Angular Forms module
- **Validation**: Implement custom validators for business logic
- **User Experience**: Provide immediate feedback and clear error messages

### Template Syntax
- **Control Flow**: Use Angular 17+ control flow syntax (@if, @for, @switch)
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
  ```typescript
  // Correct
  selector: "app-example"
  templateUrl: "./example.component.html"
  
  // Avoid
  selector: 'app-example'
  templateUrl: './example.component.html'
  ```
- **No Comments in Code**: Use self-documenting method names instead of comments
  ```typescript
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
  ```bash
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
  ```bash
  # Deploy to environments (from server directory)
  npm run deploy
  
  # Manage deployment configurations
  npm run manage-configs
  ```
- **Deployment Scripts**: Located in `server/deploy/deploy-to-environments.ts` and `server/deploy/manage-configs.ts`
