# Screenplay Pattern Implementation

## ✅ Complete - Properly Wired Serenity/JS with Screenplay Pattern

The migration system now properly uses the Serenity/JS Screenplay pattern with Actors, Tasks, and Questions.

## Architecture

### Actor-Based Design

The migration engine creates an Actor that performs all scraping operations:

```typescript
type Ctx = {
  config: SiteMigrationConfig;
  browser: WebdriverIO.Browser;
  actor: Actor;  // The migration agent
};
```

### Screenplay Components

#### Tasks (Actions)
Located in `screenplay/tasks/`:

1. **NavigateAndWait** - Navigates to a URL
   ```typescript
   await ctx.actor.attemptsTo(
     NavigateAndWait.to(url, Duration.ofSeconds(30))
   );
   ```

2. **ScrapePageContent** - Scrapes content using selectors (not currently used directly)

#### Questions (Data Extraction)
Located in `screenplay/questions/`:

1. **PageLinks** - Extracts page links from navigation menu
   ```typescript
   const pageLinks = await ctx.actor.answer(
     PageLinks.from(baseUrl, menuSelector)
   );
   ```

2. **ScrapedData** - Extracts HTML and images from page
   ```typescript
   const {html, images} = await ctx.actor.answer(
     ScrapedData.from(contentSelector, excludeSelectors)
   );
   ```

### Usage Example

```typescript
// Initialize context with actor
const ctx: Ctx = {config, browser: null, actor: null};

// Browser launch creates the actor
await launchBrowser(ctx);

// Actor performs navigation
await ctx.actor.attemptsTo(
  NavigateAndWait.to(url)
);

// Actor answers questions about the page
const links = await ctx.actor.answer(
  PageLinks.from(baseUrl, selector)
);

const data = await ctx.actor.answer(
  ScrapedData.from(contentSelector, excludes)
);
```

## Environment Configuration

### Environment Variable

Added to `Environment` enum in `environment-model.ts`:

```typescript
export enum Environment {
  ...
  USE_SERENITY_FOR_MIGRATION = "USE_SERENITY_FOR_MIGRATION",
}
```

### Usage

```typescript
import { envConfig } from "../env-config/env-config";
import { Environment } from "../env-config/environment-model";

const USE_SERENITY = envConfig.booleanValue(Environment.USE_SERENITY_FOR_MIGRATION);
```

## Type Safety

### Exported Interfaces

All inline types have been converted to proper interfaces in `migration-types.ts`:

```typescript
export interface BaseHrefResult {
  baseHref: string | null;
}

export interface HtmlFetchResult {
  html: string;
  baseUrl: string;
}

export interface BrowserContext {
  browser: WebdriverIO.Browser;
}
```

### Type Casting

Questions use proper type casting to work with Serenity/JS:

```typescript
const result = await actor.answer(
  ExecuteScript.sync(...)
) as unknown as PageLink[];
```

## Dynamic Selectors

All page selectors are passed dynamically - nothing is hard-coded:

```typescript
// Dynamic menu selector
PageLinks.from(ctx.config.baseUrl, ctx.config.menuSelector)

// Dynamic content selector
ScrapedData.from(ctx.config.contentSelector, ctx.config.excludeSelectors)
```

## Implementation Details

### Key Functions Using Screenplay

1. **scrapePageLinks()**
   - Uses `NavigateAndWait` task
   - Uses `PageLinks` question
   - Returns array of page links

2. **scrapePageContent()**
   - Uses `NavigateAndWait` task
   - Uses `ScrapedData` question
   - Processes HTML with Turndown
   - Segments content by images

3. **scrapeAlbum()**
   - Uses `NavigateAndWait` task
   - Uses `ScrapedData` question
   - Filters logo images
   - Creates album metadata

### Flow Diagram

```
migrateStaticSite()
    ↓
Initialize Context {config, browser: null, actor: null}
    ↓
launchBrowser(ctx)
    ↓
ctx.browser = await sharedLaunchBrowser()
ctx.actor = await createActor(ctx.browser)
    ↓
scrapePageLinks(ctx)
    ↓
ctx.actor.attemptsTo(NavigateAndWait.to(baseUrl))
    ↓
ctx.actor.answer(PageLinks.from(baseUrl, menuSelector))
    ↓
For each page link:
    scrapePageContent(ctx, pageLink)
        ↓
    ctx.actor.attemptsTo(NavigateAndWait.to(pageLink.path))
        ↓
    ctx.actor.answer(ScrapedData.from(contentSelector, excludeSelectors))
        ↓
    Process markdown and segments
        ↓
    createPageContent()
```

## Benefits of This Implementation

### 1. True Screenplay Pattern
- Actors perform actions via Tasks
- Actors answer Questions to get data
- Clear separation of concerns

### 2. Type Safety
- All inline types exported as interfaces
- Proper type casting with `as unknown as T`
- Zero TypeScript compilation errors

### 3. Maintainability
- Tasks are reusable across different scrapers
- Questions encapsulate data extraction logic
- Easy to add new Tasks or Questions

### 4. Dynamic Configuration
- All selectors passed as parameters
- Nothing hard-coded
- Fully configurable via SiteMigrationConfig

### 5. Environment Integration
- Follows established pattern from commit b93c69b8
- Uses `envConfig.booleanValue()`
- Centralized in Environment enum

## Files Modified/Created

### Created
- `screenplay/tasks/navigate-and-wait.ts` - Navigation task
- `screenplay/tasks/scrape-page-links.ts` - Page link scraping task (reference)
- `screenplay/tasks/scrape-page-content.ts` - Content scraping task (reference)
- `screenplay/questions/page-links.ts` - Page link extraction question
- `screenplay/questions/scraped-data.ts` - Data scraping question
- `screenplay/questions/page-content.ts` - Generic page content question (reference)
- `screenplay/page-elements/migration-page.ts.unused` - Page element locators (reference)
- `screenplay/page-elements/README.md` - Documentation
- `migration-types.ts` - Exported type interfaces

### Modified
- `environment-model.ts` - Added USE_SERENITY_FOR_MIGRATION
- `migration-routes.ts` - Uses Environment enum and BaseHrefResult interface
- `serenity-migration-engine.ts` - Properly uses Actor, Tasks, and Questions
- `serenity-migration-utils.ts` - Exports createActor()
- `serenity-utils.ts` - Browser launching with proper types

## Testing

### Enable Serenity/JS

```bash
export USE_SERENITY_FOR_MIGRATION=true
npm run server
```

### Test Migration

```typescript
import { migrateStaticSite } from "./serenity-migration-engine";

const config: SiteMigrationConfig = {
  siteIdentifier: "test-site",
  baseUrl: "https://example.com",
  menuSelector: ".nav a",
  contentSelector: "#main",
  excludeSelectors: [".ads", ".footer"],
  persistData: false,
  uploadTos3: false
};

const result = await migrateStaticSite(config);
```

### Verify Actor Usage

Check debug logs for:
- Actor creation
- Task execution (`NavigateAndWait`)
- Question answering (`PageLinks.from`, `ScrapedData.from`)

## Compilation Status

✅ **0 TypeScript errors**
✅ **All types properly defined**
✅ **Full Screenplay pattern implementation**
✅ **Dynamic selectors (no hard-coding)**
✅ **Environment variable integration**

## Next Steps

1. Test with real migration scenarios
2. Add more reusable Tasks if needed
3. Create additional Questions for specific data extraction
4. Consider adding Serenity BDD reporting
5. Implement parallel scraping with multiple Actors (future enhancement)
