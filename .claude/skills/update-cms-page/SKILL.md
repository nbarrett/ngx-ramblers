---
name: update-cms-page
description: Update or create CMS pages on NGX-Ramblers sites. Use when the user asks to update, edit, or create page content (e.g., contact-us, about-us, home) — NOT for publishing technical articles (use publish-article for that). Handles nested rows, contact buttons, images, button styling, and multi-column layouts.
argument-hint: <page-path-and-description>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, WebFetch, WebSearch
---

# Update CMS Page on NGX-Ramblers

You are updating or creating a CMS page on an NGX-Ramblers website. For the CMS data model, client API, image rules, and base patterns, refer to the `publish-article` skill SKILL.md at `.claude/skills/publish-article/SKILL.md`. This skill documents **additional patterns** specific to page editing.

## Arguments

`$ARGUMENTS` — description of what page to update and what changes to make.

## Approach

Write a TypeScript script using the CMS client API. Keep one-off scripts out of git (a local working directory is fine). Run from `server/`:

```bash
cd server
CMS_URL="${CMS_URL:-http://localhost:5001}" ../.claude/skills/connect-env-db/scripts/with-cms-login.sh npx tsx <script>
```

Default `CMS_URL` is the local API. Set it only when the user names another site.

## Page-Specific Patterns (beyond publish-article)

### Vertical Spacing
Use `marginTop` and `marginBottom` on `PageContentRow` (values 1-5). Split content into separate rows to control spacing between sections.

### Nested Rows Inside Columns (Card Layout)

The key pattern for contact pages, feature grids, and card-based layouts. Each column contains its own nested `rows` array. **Use this instead of ACTION_BUTTONS** when cards need query-parameter links (e.g., contact-us links).

**CRITICAL — Nested row requirements (all are mandatory or the row renders as empty):**
1. Every nested row MUST have `type: PageContentType.TEXT` (or another valid type) — a row without a `type` renders nothing
2. Every nested row MUST have `showSwiper: false` and `maxColumns: 1`
3. Every nested row MUST have a `columns` array with at least one column
4. Every nested column MUST have `columns: 12` and `accessLevel: "public"`
5. Every nested column MUST have `contentText` and/or `imageSource` — a column with neither renders as empty space

**Never create nested rows via raw API calls (e.g., WebFetch).** Always use a TypeScript script with the CMS client API so the data structure is type-checked. Raw JSON manipulation is error-prone and has caused empty nested rows in the past.

### Route Page POI Pattern (Two-Column Layout)

Walking route pages use an 8+4 column layout in the main content row: directions on the left (width 8), Points of Interest on the right (width 4). The right column uses nested rows for POI content. Copy the layout from an existing route page on the **target** site if one exists.

```typescript
function poiTextRow(contentText: string): any {
  return {
    type: PageContentType.TEXT,
    showSwiper: false,
    maxColumns: 1,
    columns: [{
      columns: 12,
      accessLevel: "public",
      contentText
    }]
  };
}

function poiImageRow(imageSource: string, caption?: string): any {
  const col: any = {
    columns: 12,
    imageSource,
    accessLevel: "public"
  };
  if (caption) col.contentText = caption;
  return {
    type: PageContentType.TEXT,
    showSwiper: false,
    maxColumns: 1,
    columns: [col]
  };
}

// Usage: set as the `rows` array on the right-hand (width 4) column
rightColumn.rows = [
  poiTextRow("## Points of Interest\n\n### POI Name\n\nDescription text..."),
  poiImageRow("https://example.com/image.jpg", "Caption text"),
  poiTextRow("### Second POI\n\nMore description..."),
  poiImageRow("https://example.com/image2.jpg")
];
```

```typescript
function contactCard(title: string, emoji: string, role: string, description: string, imageSource?: string): PageContentColumn {
  const column: any = {
    columns: 12,
    accessLevel: AccessLevel.PUBLIC,
    imageBorderRadius: 6,
    imageHeight: 200,
    showTextAfterImage: true,
    contentText: `#### ${emoji} ${title}\n\n[${emoji} Contact ${title.split(" ")[0]}](?contact-us&role=${role}&redirect=contact-us)\n\n${description}`,
    styles: { class: "as-button" }
  };
  if (imageSource) { column.imageSource = imageSource; }
  else { column.showPlaceholderImage = true; }
  return {
    columns: 4,
    rows: [{
      type: PageContentType.TEXT,
      showSwiper: false,
      maxColumns: 1,
      marginTop: 2,
      marginBottom: 3,
      columns: [column]
    }]
  };
}
```

### Contact-Us Links

Triggered by query parameter links in markdown:

```markdown
[Button Text](?contact-us&role=ROLE&redirect=PAGE_PATH)
```

**Available committee roles:** `secretary`, `walks`, `membership`, `social`, `chairman`, `webmaster`, `publicity`, `treasurer`, `support`

**CRITICAL:** These links only work in TEXT rows with `styles: { class: "as-button" }`. They do NOT work as `href` in ACTION_BUTTONS (query params get treated as a path — results in "Page not found").

### "Make Links Buttons" Styling

Add `styles: { class: "as-button" }` to a `PageContentColumn` to render all markdown links as yellow CTA buttons.

Other style options: `""` (clear), `"d-none"` (hide), `"text-style-cloudy"`, `"text-style-granite"`, `"text-style-mintcake"`, `"text-style-rosycheeks"`, `"text-style-sunrise"`, `"text-style-sunset"`, `"text-style-grey"`.

### Uploading Images to S3 via CMS API

To upload local images to S3, POST multipart form data to the CMS file-upload endpoint. The server has the AWS credentials — you do not need local AWS env vars.

```typescript
import { CMSAuth } from "../../server/lib/shared/cms-client";
import * as fs from "fs";
import * as path from "path";

async function uploadImageViaCms(auth: CMSAuth, localPath: string, rootFolder: string = "site-content"): Promise<string> {
  const fileBuffer = fs.readFileSync(localPath);
  const fileName = path.basename(localPath);
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: "image/png" });
  formData.append("file", blob, fileName);

  const url = `${auth.baseUrl}/api/aws/s3/file-upload?root-folder=${rootFolder}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Authorization": `Bearer ${auth.authToken}` },
    body: formData
  });

  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);

  const data = await response.json();
  const uploaded = data.responses?.[0];
  if (!uploaded?.fileNameData) throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  return `${rootFolder}/${uploaded.fileNameData.awsFileName}`;
}
```

The returned string (e.g. `site-content/uuid.png`) is used directly as the `imageSource` field value.

### Discovering Available Images

To find images already in S3 on a site, use `fetchAllPages(auth)` and scan for `imageSource` fields across all pages.

### Index Pages (Album-Index Pattern)

To make a parent page show cards linking to its child pages, add an `album-index` row. This is the canonical pattern — copy it exactly:

```typescript
{
  type: PageContentType.ALBUM_INDEX,
  maxColumns: 2,
  showSwiper: false,
  columns: [{ columns: 12, accessLevel: "public" }],
  albumIndex: {
    contentPaths: [{
      contentPath: "events",        // parent path prefix
      stringMatch: "starts-with",
      maxPathSegments: 2            // parent depth + 1 (shows direct children only)
    }],
    autoTitle: true,
    showInParentIndex: true,
    contentTypes: ["index-pages", "pages"],
    renderModes: ["action-buttons"],
    sortConfig: { field: "title", direction: "asc" },
    excludePaths: [],
    entryOverrides: {},
    columnOverrides: []
  }
}
```

**Key settings:**
- `maxPathSegments`: set to parent path depth + 1. For `events` (depth 1) use `2`. For `walks/routes` (depth 2) use `3`.
- `contentTypes`: `["index-pages", "pages"]` shows all child pages. Use `["index-pages"]` to only show pages that themselves have children.
- `renderModes`: `["action-buttons"]` renders as clickable cards with images.
- `maxColumns`: controls the grid layout (2 = two cards per row).

**Child pages need images:** The album-index cards pull `imageSource` from each child page's first row. Always set `imageSource` on row 0 of child pages, and **verify the image loads** (HEAD request returning 200) before assigning it. Images using `site-content/` prefix must exist in that specific site's S3 bucket — UUIDs from other sites will 404.

**CRITICAL:** When adding an album-index row to an existing page, **never overwrite existing rows**. Fetch the page first, then append or insert the album-index row. Also preserve any existing `events` type rows (which show walks/events from the API) — these are separate from album-index rows.

### Updating Existing Pages (Append Pattern)

To add content to an existing page without overwriting it, fetch the page first and append new rows:

```typescript
const existing = await pageContent(auth, pagePath);
if (!existing) throw new Error(`Page not found: ${pagePath}`);

const updatedPage: PageContent = {
  ...existing,
  rows: [...(existing.rows || []), ...newRows]
};
await updatePageContent(auth, existing.id!, updatedPage);
```

### Database configuration

AWS, Brevo and similar settings live in this environment's `config` collection. Key documents: `system` (header, footer, logos, nav), `brevo`, `committee`. See `connect-env-db` for how to open the database this checkout actually has.

## Branding

- Use "NGX-Ramblers" (with dash) not "NGX Ramblers"
- Use UK English ("centralised", "colour", "behaviour")
- Use "Ramblers" not "the Ramblers"
