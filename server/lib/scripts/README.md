# CMS Update Scripts

This directory contains reusable tools for making one-off CMS content updates.

## Important

**Scripts in this directory should NOT be committed to git.** They are meant for temporary, one-off updates.

## Usage

### Setup

Required environment variables:
```bash
export CMS_USERNAME="your-username"
export CMS_PASSWORD="your-password"
export CMS_BASE_URL="http://localhost:5001"  # or staging/prod URL
```

### Creating a One-Off Update Script

Copy this template to create a new update script (e.g., in `/tmp` or `server/`):

```typescript
import {
  updatePages,
  forEachColumn,
  TransformResult,
  PageContent
} from "./lib/scripts/cms-update-template";

async function transformPage(pageContent: PageContent): Promise<TransformResult> {
  const changes: string[] = [];
  let modified = false;

  // Example: Update all columns
  forEachColumn(pageContent, (column, row, rowIndex, columnIndex) => {
    // Your transformation logic here
    if (column.contentText?.includes("old-text")) {
      column.contentText = column.contentText.replace("old-text", "new-text");
      changes.push(`Updated row ${rowIndex}, column ${columnIndex}`);
      modified = true;
    }
  });

  return { modified, changes };
}

updatePages(
  {
    paths: [
      "path/to/page1",
      "path/to/page2"
    ],
    dryRun: true  // Set to false to actually update
  },
  transformPage
);
```

Run with:
```bash
npx tsx your-script.ts
```

## Utility Functions

### `forEachColumn(pageContent, callback)`
Iterates over all columns (including nested ones) in page content.

```typescript
forEachColumn(pageContent, (column, row, rowIndex, columnIndex) => {
  // Access and modify column
});
```

### `extractYouTubeId(url)`
Extracts YouTube video ID from various URL formats.

```typescript
const id = extractYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
// Returns: "dQw4w9WgXcQ"
```

### `replaceMarkdownLinks(text, replacer)`
Finds and replaces markdown links in text.

```typescript
const { result, replacements } = replaceMarkdownLinks(
  text,
  (linkText, url) => {
    if (url.includes("youtube.com")) {
      return { newText: "", transformed: true };  // Remove link
    }
    return { newText: `[${linkText}](${url})`, transformed: false };
  }
);
```

## Common Patterns

### Convert YouTube Links to Embedded Videos

```typescript
import { extractYouTubeId, replaceMarkdownLinks } from "./lib/scripts/cms-update-template";

forEachColumn(pageContent, (column) => {
  if (column.contentText) {
    const { result, replacements } = replaceMarkdownLinks(
      column.contentText,
      (linkText, url) => {
        const youtubeId = extractYouTubeId(url);
        if (youtubeId) {
          column.youtubeId = youtubeId;
          column.alt = linkText;
          return { newText: "", transformed: true };
        }
        return { newText: `[${linkText}](${url})`, transformed: false };
      }
    );

    if (replacements > 0) {
      column.contentText = result.trim();
      changes.push(`Converted ${replacements} YouTube link(s) to embedded videos`);
      modified = true;
    }
  }
});
```

### Update Image Sources

```typescript
forEachColumn(pageContent, (column) => {
  if (column.imageSource?.includes("old-cdn.com")) {
    column.imageSource = column.imageSource.replace(
      "old-cdn.com",
      "new-cdn.com"
    );
    changes.push("Updated image CDN URL");
    modified = true;
  }
});
```

### Add Missing Alt Text

```typescript
forEachColumn(pageContent, (column) => {
  if (column.imageSource && !column.alt) {
    column.alt = "Default alt text";
    changes.push("Added missing alt text");
    modified = true;
  }
});
```

### Bulk Text Replacement

```typescript
forEachColumn(pageContent, (column) => {
  if (column.contentText?.includes("Company Name Inc")) {
    column.contentText = column.contentText.replace(
      /Company Name Inc/g,
      "New Company Name"
    );
    changes.push("Updated company name");
    modified = true;
  }
});
```

## Dry Run Mode

Always test with `dryRun: true` first:

```typescript
updatePages(
  {
    paths: ["path/to/page"],
    dryRun: true  // Will show what would be changed without updating
  },
  transformPage
);
```

Then run with `dryRun: false` to actually update:

```typescript
updatePages(
  {
    paths: ["path/to/page"],
    dryRun: false  // Actually updates the content
  },
  transformPage
);
```
