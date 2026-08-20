---
name: publish-article
description: Publish technical articles to the NGX Ramblers CMS. Use when the user asks to publish, create, or update a technical article on the site. Handles CMS login, page creation/update, index management, action buttons, images, and Mermaid diagrams.
argument-hint: <markdown-file-or-topic>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, WebFetch, WebSearch
---

# Publish Article to NGX Ramblers CMS

You are publishing a technical article to the NGX Ramblers website CMS.

## Arguments

`$ARGUMENTS` — either a path to a markdown file, or a topic description to generate an article about.

## Quick Start — Single Article

If given a markdown file path, publish it using the existing script:

```bash
cd server
CMS_URL="${CMS_URL:-http://localhost:5001}" ../.claude/skills/connect-env-db/scripts/with-cms-login.sh npx tsx lib/release-notes/publish-technical-article.ts <markdown-file>
```

The script handles login, page creation/update, and index page updating automatically.

## Article File Format

Markdown files can live anywhere locally. A useful name is `YYYY-MM-DD-article-name.md`.

First line MUST be: `# DD-Mon-YYYY — Article Title`

Followed by `_____` (horizontal rule) then the article body.

Example:
```markdown
# 18-Mar-2026 — My Article Title

_____

Article content here...
```

## CMS Data Model

### PageContent
```
PageContent { path, rows: PageContentRow[] }
PageContentRow { type, showSwiper, maxColumns, columns: PageContentColumn[] }
PageContentColumn { title, href, contentText, imageSource, imageBorderRadius, showTextAfterImage, icon, accessLevel, columns }
```

### Row Types
- `PageContentType.TEXT` — markdown content
- `PageContentType.ACTION_BUTTONS` — card grid with images/icons linking to pages

### Images — CRITICAL RULES
- **NEVER use markdown image syntax** (`![alt](url)`) in CMS content
- Use `imageSource` field on `PageContentColumn` — NOT inline markdown images
- S3 paths: `"site-content/uuid.jpg"` (auto-prefixed with `api/aws/s3/`)
- External URLs: `"https://example.com/image.jpg"` (used as-is)

### `showTextAfterImage` — Text/Image Ordering
Controls whether `contentText` appears **before** or **after** the `imageSource` image:
- `showTextAfterImage: true` — image renders first, text appears **below** the image (use for hero images where a large image leads, followed by article text)
- `showTextAfterImage: false` (or omitted) — text renders first, image appears **below** the text (use when a heading or caption should appear **above** a screenshot or illustration)

### Hero Image Pattern
To add a hero image above article text, set both `imageSource` and `contentText` on the same column with `showTextAfterImage: true`:
```typescript
{
  type: PageContentType.TEXT,
  showSwiper: false,
  maxColumns: 1,
  columns: [{
    imageSource: "site-content/<uuid-on-this-site>.jpeg",
    imageBorderRadius: 6,
    showTextAfterImage: true,
    contentText: markdownContent,
    columns: 12
  }]
}
```

### Action Buttons Pattern
**WARNING:** ACTION_BUTTONS `href` does NOT support query parameters (e.g., `?contact-us&role=...`). For contact links or any query-param-based navigation, use nested TEXT rows with `styles: { class: "as-button" }` instead. See the `update-cms-page` skill for the nested row card pattern.

```typescript
{
  type: PageContentType.ACTION_BUTTONS,
  showSwiper: false,
  maxColumns: 3,
  columns: [{
    title: "Card Title",
    href: "path/to/page",  // path only, no query params
    imageSource: "site-content/uuid.jpg",
    imageBorderRadius: 6,
    contentText: "Card description",
    accessLevel: "public",
    columns: 4
  }]
}
```

### "Make Links Buttons" Styling
Add `styles: { class: "as-button" }` to a `PageContentColumn` to render markdown links as yellow CTA buttons:
```typescript
{
  columns: 12,
  accessLevel: AccessLevel.PUBLIC,
  contentText: "[🚀 Click Me](?contact-us&role=support&redirect=contact-us)",
  styles: { class: "as-button" }
}
```

### Nested Row Card Pattern
For card-based layouts with images and contact buttons, use columns with nested `rows`:
```typescript
{
  columns: 4,
  rows: [{
    type: PageContentType.TEXT,
    showSwiper: false,
    maxColumns: 1,
    marginTop: 2,
    marginBottom: 3,
    columns: [{
      columns: 12,
      accessLevel: AccessLevel.PUBLIC,
      imageSource: "site-content/uuid.jpg",
      imageBorderRadius: 6,
      imageHeight: 200,
      showTextAfterImage: true,
      contentText: "#### Title\n\n[Contact](?contact-us&role=secretary&redirect=contact-us)\n\nDescription",
      styles: { class: "as-button" }
    }]
  }]
}
```

## CMS Client API

**Module:** `server/lib/shared/cms-client.ts`

```typescript
import { login, createOrUpdatePageContent, pageContent } from "../shared/cms-client";
const auth = await login(baseUrl, username, password);
await createOrUpdatePageContent(auth, pageContentObject);
const page = await pageContent(auth, "path/to/page");
```

## Mermaid Diagrams

Articles support Mermaid via `ngx-markdown`. Two icon packs are registered:

**Custom `ngx:` icons** (defined in `projects/ngx-ramblers/src/app/icons/custom-icon-pack.ts`):
`ngx:mongodb`, `ngx:cloudflare`, `ngx:aws`, `ngx:brevo`, `ngx:express`, `ngx:meetup`, `ngx:ramblers`, `ngx:ramblers-hq`, `ngx:user`, `ngx:os-maps`, `ngx:mailchimp`, `ngx:file`

**Standard `logos:` icons** (from `@iconify-json/logos`):
`logos:angular-icon`, `logos:fly-icon`, `logos:docker-icon`, `logos:google-maps`, `logos:bootstrap`, `logos:github-icon`, `logos:github-actions`, `logos:typescript-icon`, `logos:nodejs-icon`, `logos:leaflet`, `logos:recaptcha`, `logos:google-analytics`, `logos:openstreetmap`

**Icon syntax in flowcharts:**
```
NODE@{ icon: "ngx:mongodb", label: "MongoDB Atlas", pos: "b", h: 48 }
```

**Subgraph styling:**
```
style subgraphName fill:#E8F5EE,stroke:#9BC8AB,stroke-width:2px,rx:12,ry:12,color:#404143
```

## Images on the target site

Do not reuse S3 object names from another environment. Discover images already on **this** site (scan `imageSource` on existing pages, or upload via the CMS file-upload API).

## Multi-page series

For a landing page plus sub-pages, write a local TypeScript script that uses `cms-client`: login, create each TEXT sub-page, then create the landing page with a TEXT row and an ACTION_BUTTONS row.

```bash
cd server
CMS_URL="${CMS_URL:-http://localhost:5001}" ../.claude/skills/connect-env-db/scripts/with-cms-login.sh npx tsx <script>
```

## Writing Style

- Use UK English ("centralised", "colour", "behaviour")
- Use "Ramblers" not "the Ramblers"
- Match Mermaid diagram style from an existing how-to article **on the target site** if one exists
