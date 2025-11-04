# Serenity/JS Migration Guide

This document explains the migration from Puppeteer to Serenity/JS for the static site migration tools.

## Overview

The migration system now supports both Puppeteer and Serenity/JS as browser automation frameworks. Serenity/JS provides better integration with WebdriverIO and follows the Screenplay pattern for more maintainable test/automation code.

## Architecture

### Files Created

1. **serenity-utils.ts** - Browser launching utilities and base configuration
2. **serenity-migration-utils.ts** - Helper functions for migration-specific operations
3. **serenity-migration-engine.ts** - Main migration engine using Serenity/JS
4. **screenplay/tasks/** - Serenity/JS Tasks for migration operations
5. **screenplay/questions/** - Serenity/JS Questions for data extraction

### Files Updated

1. **migration-routes.ts** - Updated to support both Puppeteer and Serenity/JS

## Usage

### Environment Variable

Set the `USE_SERENITY_FOR_MIGRATION` environment variable to control which framework is used:

```bash
export USE_SERENITY_FOR_MIGRATION=true
```

When `true`, the system uses Serenity/JS. When `false` or unset, it uses Puppeteer (default).

### Using the Serenity Migration Engine

```typescript
import { migrateStaticSite } from "./lib/migration/serenity-migration-engine";

const config: SiteMigrationConfig = {
  siteIdentifier: "example-site",
  baseUrl: "https://example.com",
  menuSelector: ".nav a",
  contentSelector: "#content",
  persistData: false,
  uploadTos3: false
};

const result = await migrateStaticSite(config);
```

### API Routes

The `/api/migration/html-from-url` endpoint now automatically uses either Puppeteer or Serenity/JS based on the environment variable.

## Key Differences

### Puppeteer Approach

```typescript
const browser = await puppeteer.launch();
const page = await browser.newPage();
await page.goto(url);
const data = await page.evaluate(() => {
  return document.querySelector("div").textContent;
});
```

### Serenity/JS Approach

```typescript
const browser = await launchBrowser();
await browser.url(url);
const data = await browser.execute(() => {
  return document.querySelector("div").textContent;
});
```

## Benefits of Serenity/JS

1. **WebdriverIO Integration** - Better cross-browser support
2. **Screenplay Pattern** - More maintainable code structure
3. **Better Reporting** - Built-in reporting via Serenity BDD
4. **Consistent with Tests** - Same framework used for E2E testing

## Screenplay Pattern Components

### Tasks

Tasks represent user actions. Example:

```typescript
export class NavigateAndWait {
  static to(url: string): Task {
    return Task.where(`navigate to ${url}`,
      Navigate.to(url),
      Wait.upTo(Duration.ofSeconds(30))
    );
  }
}
```

### Questions

Questions extract data from the page. Example:

```typescript
export class ScrapedData extends Question<Promise<ScrapeResult>> {
  constructor(private selector: string) {
    super(`scraped data from ${selector}`);
  }

  static from(selector: string): ScrapedData {
    return new ScrapedData(selector);
  }

  async answeredBy(actor: UsesAbilities & AnswersQuestions): Promise<ScrapeResult> {
    return await actor.attemptsTo(
      ExecuteScript.sync((sel) => {
        return {
          html: document.querySelector(sel).innerHTML
        };
      }).withArguments(this.selector)
    );
  }
}
```

## Migration Notes

### Browser Configuration

Both Puppeteer and Serenity/JS use similar Chrome flags for headless operation:

- `--headless=new` or `--headless`
- `--no-sandbox`
- `--disable-setuid-sandbox`
- `--disable-dev-shm-usage`
- `--disable-accelerated-2d-canvas`
- `--no-first-run`
- `--no-zygote`
- `--disable-gpu`

### Timeout Handling

Serenity/JS uses `waitUntil` with explicit conditions:

```typescript
await browser.waitUntil(async () => {
  const state = await browser.execute(() => document.readyState);
  return state === "complete";
}, {
  timeout: 30000,
  timeoutMsg: "Page did not load within 30 seconds"
});
```

### Page Evaluation

Both frameworks support executing JavaScript in the page context, but the syntax differs slightly:

**Puppeteer:**
```typescript
await page.evaluate((arg1, arg2) => { ... }, value1, value2);
```

**WebdriverIO:**
```typescript
await browser.execute((arg1, arg2) => { ... }, value1, value2);
```

## Testing

To test the Serenity/JS migration:

1. Set environment variable:
   ```bash
   export USE_SERENITY_FOR_MIGRATION=true
   ```

2. Start the server:
   ```bash
   npm run server
   ```

3. Test the HTML-from-URL endpoint:
   ```bash
   curl -X POST http://localhost:4000/api/migration/html-from-url \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com"}'
   ```

4. Run the full migration:
   ```typescript
   const config = { ... };
   const result = await migrateStaticSite(config);
   ```

## Troubleshooting

### Chrome/ChromeDriver Issues

If you encounter Chrome/ChromeDriver version mismatches:

1. Update WebdriverIO:
   ```bash
   npm update webdriverio
   ```

2. Clear the driver cache:
   ```bash
   rm -rf ~/.cache/selenium
   ```

### Memory Issues

For large migrations, increase Node.js memory:

```bash
node --max-old-space-size=4096 server
```

### Debugging

Enable debug logs:

```bash
export DEBUG=static-html-site-migrator-serenity:*
```

## Future Enhancements

1. Add Serenity BDD reporting for migrations
2. Implement parallel page scraping with multiple actors
3. Add screenshot capture on errors
4. Create custom Serenity/JS questions for common scraping patterns
5. Add support for authentication flows using Serenity/JS interactions
