# Static Site Migration: Data Flow

This document explains how content flows from a site migration configuration through scraping, Markdown conversion, filtering, segmentation, transformation, and into the final `PageContent` model used by NGX‑Ramblers.

## High‑Level Flow

1. Configure migration in `SiteMigrationConfig`
2. Discover and scrape pages with Puppeteer
3. Sanitize DOM (remove attributes/styles) and absolutise image URLs
4. Convert sanitized HTML → Markdown (Turndown)
5. Apply text exclusions and filtering on Markdown
6. Segment Markdown into ordered text/image `segments`
7. Execute `PageTransformationEngine` steps
8. Populate `PageContent` rows/columns
9. Optionally persist to MongoDB

## Inputs

- `SiteMigrationConfig` controls scraping and transformation:
  - Base URL, menu/content selectors, exclusion selectors, text/image filters
  - Parent/child page handling, optional album scraping
  - Page transformation steps (editor driven)
  - File: `projects/ngx-ramblers/src/app/models/migration-config.model.ts:20`

## Scraping & HTML → Markdown

- Entry: `migrateStaticSite(config)`
  - Orchestrates scraping, transformation, and optional persistence
  - File: `server/lib/migration/migrate-static-site-engine.ts:834`

- Link discovery: `scrapePageLinks(ctx)`
  - Extracts site links from configured menus
  - File: `server/lib/migration/migrate-static-site-engine.ts:108`

- Page scraping: `scrapePageContent(ctx, pageLink)`
  - Loads page with Puppeteer, scopes to `contentSelector`
  - DOM sanitisation occurs in the browser context:
    - Removes nodes matched by `excludeSelectors`
    - Removes `<style>` tags
    - Strips presentational attributes from all elements: `class`, `style`, `id`, `width`, `height`, `align`, `border`, `valign`, `bgcolor`, `cellpadding`, `cellspacing`, `hspace`, `vspace`, `frame`, `rules`
    - Absolutises all `img.src` to full URLs
  - Converts sanitized HTML → Markdown with Turndown
  - Applies Markdown text filtering via `applyTextExclusions` (see Filtering)
  - Splits Markdown into ordered `segments` (see Segmentation)
  - Returns `ScrapedPage { path, title, segments, firstImage }`
  - File: `server/lib/migration/migrate-static-site-engine.ts:140`

## Filtering (Markdown)

- `applyTextExclusions(text, cfg)` performs:
  - Text pattern removals (built‑ins and configured)
  - Markdown block removals (exact/tolerant/sequences)
  - Excluded images removal (bare or link‑wrapped)
  - Inline CSS rule removal (e.g. `.class { ... }`, `body { ... }`)
  - Inline HTML attribute removal: `class`, `id`, `style`, `align`, `border`, `valign`, `bgcolor`, `cellpadding`, `cellspacing`, `hspace`, `vspace`, `frame`, `rules`, `width`, `height` (quoted or unquoted)
  - Attribute‑list removal (e.g. `{#id .class style="..."}`), while preserving link hashes in Markdown links like `[Jump](#eden)`
  - File: `server/lib/migration/text-exclusions.ts:123`

## Segmentation

- Goal: preserve the interleaved order of text and images from Markdown
- Process:
  - For each image found in the DOM, build markers to find it in Markdown:
    - `![alt](absolute)`, `![alt](/path/to.jpg)`, `![alt](file.jpg)`
  - Iteratively split Markdown on the next image marker and push:
    - A text segment for the content before the marker (if any)
    - An image segment for the marker (with `src`, `alt`)
  - Push any trailing text as a final text segment
- Types:
  - `ScrapedSegment { text?: string; image?: ScrapedImage }`
  - `ScrapedImage { src: string; alt: string }`
  - File: `projects/ngx-ramblers/src/app/models/migration-scraping.model.ts:16`
- Implementation: `server/lib/migration/migrate-static-site-engine.ts:200`

## Transformation Engine

- `PageTransformationEngine.transform(page, config, uploadImageFn)` consumes `ScrapedPage` and a `PageTransformationConfig`
  - File: `server/lib/migration/page-transformation-engine.ts:16`

- Context: `TransformationContext`
  - Holds original `segments`, combined `markdown` (text‑only), tracking sets for consumed indices, and constructed `rows`
  - File: `server/lib/migration/page-transformation-engine.ts:18`

- Common actions (configured in the editor):
  - `CONVERT_TO_MARKDOWN`
    - Extracts text‑only segments into `ctx.markdown` and `remainingText`
  - `CREATE_PAGE`
    - Initialises `ctx.rows` for output
  - `ADD_ROW`
    - Builds a row with columns; each column may contain a content matcher
    - Text matchers: `ALL_TEXT_UNTIL_IMAGE`, `ALL_TEXT_AFTER_HEADING`, `PARAGRAPH`, `CUSTOM_REGEX`, `REMAINING_TEXT`
    - Image matchers: `FIRST_IMAGE`, `FILENAME_PATTERN`, `ALT_TEXT_PATTERN`, `REMAINING_IMAGES`, `ALL_IMAGES`
    - Combined: `ALL_CONTENT` (text + images as Markdown)
  - `ADD_NESTED_ROWS`
    - `COLLECT_WITH_BREAKS` walks `segments` in order:
      - Buffers text until an image boundary, then emits a text row
      - Emits an image row per image
      - Optionally groups short caption text immediately following an image
      - Stops on configured `SegmentType` (e.g., `HEADING`), handling ATX (`#`) and Setext (`===/---`) headings and grouping “text before heading” as image captions when appropriate

## Output Model

- `PageContent` is the final structure persisted/rendered by NGX‑Ramblers:
  - `PageContent { path: string; rows: PageContentRow[] }`
  - `PageContentRow { type, maxColumns, showSwiper, columns, rows? }`
  - `PageContentColumn { columns, contentText?, imageSource?, alt?, rows? }`
  - File: `projects/ngx-ramblers/src/app/models/content-text.model.ts:5`

## Key Interfaces

- `SiteMigrationConfig`
  - `projects/ngx-ramblers/src/app/models/migration-config.model.ts:20`
- `ScrapedPage`, `ScrapedSegment`, `ScrapedImage`
  - `projects/ngx-ramblers/src/app/models/migration-scraping.model.ts:16`
- `PageTransformationConfig`, `TransformationActionType`, `ContentMatchType`, `TextMatchPattern`, `ImageMatchPattern`, `SegmentType`
  - `projects/ngx-ramblers/src/app/models/page-transformation.model.ts`
- `PageContent` family
  - `projects/ngx-ramblers/src/app/models/content-text.model.ts:5`

## Debugging Tips

- Enable debug: `DEBUG=ekwg:*` (already set by `server/test-setenv.sh`)
- Useful logs:
  - Scrape: link counts, attribute removal summary, first 500 chars of Markdown
  - Segmentation: markers tried, split diagnostics
  - Transform: step execution, matcher counts, nested row creation totals

## At a Glance

Config → Links → Sanitized DOM → Turndown → Markdown Exclusions → Segments → Transform Steps → PageContent

This layered approach keeps the raw scrape predictable, the Markdown clean and portable, and the transformation flexible via declarative steps.
