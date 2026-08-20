---
name: migrate-site
description: Migrate content from a legacy Ramblers group website into an NGX Ramblers CMS environment. Use when the user asks to populate, migrate, scrape, or set up content for a new NGX Ramblers environment. Handles page scraping, content transformation, album creation, navbar configuration, and CMS population.
argument-hint: <environment-name> [old-site-url]
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, WebFetch, WebSearch
---

# Migrate Legacy Site Content to NGX Ramblers

You are migrating content from a legacy Ramblers group website into an NGX Ramblers CMS environment.

## Arguments

`$ARGUMENTS` — the target environment name and optionally the old site URL.

## Before You Start

1. Read `server/lib/migration/README.md` for the full data flow
2. Read `docs/migration/cms-api-reference.md` for CMS API patterns
3. Ask the user for the old site URL if it is not in the request

## Phase 1: Discovery

### Identify the sites
- **Target environment**: use the environment name to determine the NGX site URL (pattern: `https://<name>.ngx-ramblers.org.uk/` or `https://ngx-ramblers-<name>.fly.dev/`)
- **Old site**: if not provided, search for the group on `ramblers.org.uk` to find their current website URL
- Use `with-cms-login.sh` for CMS credentials. Do not guess a username pattern.

### Audit the target environment
```bash
# Login
AUTH=$(curl -s -X POST https://<new-site>/api/database/auth/login \
  -H "Content-Type: application/json" \
  -d '{"userName":"<user>","password":"<pass>"}' | python3 -c "import json,sys; print(json.load(sys.stdin)['tokens']['auth'])")

# Get all existing pages
curl -s https://<new-site>/api/database/page-content/all \
  -H "Authorization: Bearer $AUTH" | python3 -m json.tool

# Get system config (navbar, footer, quick links)
curl -s "https://<new-site>/api/database/config?key=system" \
  -H "Authorization: Bearer $AUTH" | python3 -m json.tool

# Get existing albums
curl -s https://<new-site>/api/database/content-metadata/all \
  -H "Authorization: Bearer $AUTH" | python3 -m json.tool

# Count synced events
curl -s https://<new-site>/api/database/group-event/count \
  -H "Authorization: Bearer $AUTH"
```

### Scrape the old site
Use `WebFetch` to extract from the old site:
- **Navigation structure** — all menu links and page URLs
- **Page content** — text, headings, images for each page
- **Image galleries** — photo collections with URLs
- **Documents** — PDF links, GPX files
- **Contact information** — addresses, phone numbers, committee roles

Build a complete page inventory mapping old URLs to proposed new CMS paths.

## Phase 2: Planning

Present the user with a migration plan:

| Old Page | New Path | Row Types | Status |
|----------|----------|-----------|--------|
| Homepage | `#home-content` | text + action-buttons | Update |
| About Us | `about-us` | text + album-index | Create |
| Walks | `walks` | events row | Keep (already exists) |
| Photos | `photos` | album-index | Create |
| Contact | `contact-us` | text | Update |

**Ask the user to confirm** before proceeding.

## Phase 3: Content Creation

### Use the CMS Client library
For programmatic page creation, use `server/lib/shared/cms-client.ts`:

```typescript
import { login, createOrUpdatePageContent, pageContent } from "./server/lib/shared/cms-client";
const auth = await login(baseUrl, username, password);
await createOrUpdatePageContent(auth, { path: "about-us", rows: [...] });
```

### Or use the CLI migration tool
```bash
cd server
npx tsx -e "..." # inline script using cms-client
# OR
ngx-cli migrate reconcile --old <url> --new <url>
ngx-cli migrate apply --old <url> --new <url> --username <user> --password <pass>
```

### Row Type Reference

**Text Row** (markdown content):
```json
{"type": "text", "showSwiper": false, "maxColumns": 1,
 "columns": [{"columns": 12, "accessLevel": "public", "contentText": "# Markdown here"}]}
```

**Events Row** (walks/events display):
```json
{"type": "events", "showSwiper": false, "maxColumns": 2,
 "columns": [{"columns": 12, "accessLevel": "public"}],
 "events": {
   "minColumns": 2, "maxColumns": 2,
   "eventTypes": ["group-walk"],
   "filterCriteria": "FUTURE_EVENTS",
   "sortOrder": "DATE_ASCENDING",
   "allow": {"addNew": true, "pagination": true, "quickSearch": true, "alert": true,
    "autoTitle": true, "advancedSearch": true, "viewSelector": true}
 }}
```

**Action Buttons Row** (navigation cards with images):
```json
{"type": "action-buttons", "showSwiper": false, "maxColumns": 3,
 "columns": [
   {"columns": 4, "title": "Page Title", "href": "page/path", "accessLevel": "public",
    "imageSource": "https://old-site.org.uk/images/photo.jpg",
    "imageBorderRadius": 6, "contentText": "Description"}
 ]}
```

**Album Index Row** (auto-navigation to child pages):
```json
{"type": "album-index", "showSwiper": false, "maxColumns": 3,
 "columns": [{"columns": 12, "accessLevel": "public"}],
 "albumIndex": {
   "contentPaths": [{"contentPath": "photos/", "stringMatch": "starts-with", "maxPathSegments": 1}],
   "autoTitle": false, "contentTypes": ["pages"], "renderModes": ["action-buttons"]
 }}
```

**Carousel/Album Row** (photo gallery):
```json
{"type": "carousel", "showSwiper": false, "maxColumns": 1,
 "columns": [{"columns": 12, "accessLevel": "public"}],
 "carousel": {
   "name": "album-name", "title": "Album Title", "showTitle": true,
   "albumView": "grid",
   "gridViewOptions": {"showTitles": true, "minColumns": 2, "maxColumns": 4,
    "layoutMode": "masonry", "imageFit": "cover", "gap": 4},
   "allowSwitchView": true
 }}
```

**Map Row** (GPX routes on Leaflet/OS Maps):
```json
{"type": "map", "showSwiper": false, "maxColumns": 1,
 "columns": [{"columns": 12, "accessLevel": "public"}],
 "map": {
   "routes": [
     {"id": "route-1", "name": "Circular Walk", "color": "GREEN", "visible": true,
      "weight": 3, "opacity": 0.8,
      "gpxFile": {"rootFolder": "gpxRoutes", "awsFileName": "uuid.gpx", "originalFileName": "walk.gpx"}}
   ],
   "markers": [],
   "mapHeight": 500,
   "autoFitBounds": true,
   "provider": "osm",
   "showControlsDefault": true,
   "allowControlsToggle": true,
   "showWaypointsDefault": false,
   "allowWaypointsToggle": true
 }}
```

**Committee Documents Row** (year covers go **here**, never on the year text row):
```json
{"type": "committee-documents", "showSwiper": false, "maxColumns": 1,
 "columns": [],
 "committeeDocuments": {
   "fileIds": ["id1", "id2"],
   "showFileActions": true,
   "sortDirection": "desc",
   "imageSource": "https://cdn.ramblers.org.uk/styles/xl/s3/…/year-cover.jpg?itok=…"
 }}
```

**Committee package (parent home `/committee`, not a year page):**

1. Parent `committee` — intro text → docs with `autoFromFirstActionButton: true` → **shared-fragment** → `fragments/committee-years` → optional migrated-from.
2. `fragments/committee-years` — album-index of `committee/*` (`maxPathSegments: 2`, `contentTypes: ["pages"]`, `renderModes: ["action-buttons"]`).
3. `committee/YYYY` children — text (heading/welcome only) + committee-documents (cover `imageSource` + `fileIds`) + **the same shared-fragment** as the parent.

Years grid cards use each year’s `committeeDocuments.imageSource` only.

### Creating Albums (Content Metadata)
```bash
curl -s -X POST https://<new-site>/api/database/content-metadata \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" \
  -d '{
    "rootFolder": "carousels",
    "name": "album-name",
    "imageTags": [],
    "files": [
      {"image": "https://old-site/images/photo.jpg", "text": "Caption", "tags": []}
    ]
  }'
```

### Updating Navbar
```bash
# GET current system config, modify pages array, POST back
curl -s "https://<new-site>/api/database/config?key=system" \
  -H "Authorization: Bearer $AUTH" > /tmp/config.json
# Edit, then:
curl -s -X POST https://<new-site>/api/database/config \
  -H "Authorization: Bearer $AUTH" \
  -H "Content-Type: application/json" \
  -d '{"key": "system", "value": <modified-config>}'
```

## Phase 4: Verification

After creating all pages:
1. Fetch all pages again and verify count matches plan
2. Check each created page renders at its URL
3. Verify navbar links work
4. Verify album images load
5. Present a summary to the user

## Critical Rules

### No fabricated content (HARD RULE)

Every word of human-readable copy on a migrated page must be **lifted from the source site**. Do not invent intro paragraphs, group descriptions, action-button captions, year captions, or any other prose — even if it sounds plausible or helpful. The committee will spot fabricated content immediately because they know their own group's voice.

If a landing page has no source equivalent (e.g. a `news` index that aggregates posts), populate it with a **heading only** plus the functional row (album-index / events feed / action-button). Do not write a description.

If a source page exists but is empty or broken, leave the new page empty and flag it for the committee to fill in. Do not synthesise content from the page title.

### Images are row boundaries (HARD RULE)

Inline markdown image syntax (`![](url)`) does NOT render in NGX text rows. Every image must be placed in its own column with `imageSource`, never inline in markdown.

When the source HTML interleaves text and images (e.g. `<p>...</p><p><img></p><p>...</p>`), treat each image as a **row boundary**. Split the surrounding text into separate text rows, with the image as its own row in between. Two valid layouts:

1. **Image-only row** (image takes full width):
   ```json
   { "type": "text", "maxColumns": 1, "showSwiper": false,
     "columns": [
       { "columns": 12, "accessLevel": "public",
         "imageSource": "https://source.example/photo.jpg",
         "alt": "descriptive alt text" }
     ]
   }
   ```

2. **Side-by-side text + image** (8/4 split, BWW scrapbook style):
   ```json
   { "type": "text", "maxColumns": 1, "showSwiper": false,
     "columns": [
       { "columns": 8, "accessLevel": "public", "contentText": "Paragraph of narrative…" },
       { "columns": 4, "accessLevel": "public",
         "imageSource": "https://source.example/photo.jpg",
         "alt": "descriptive alt text" }
     ]
   }
   ```

Pick (2) when the source clearly pairs a paragraph with a photo (typical for walk write-ups). Otherwise use (1).

When converting via Turndown, post-process the markdown to detect image lines (`![alt](url)` or linked images `[![alt](url)](href)`) and split them out into image rows. The text before each image becomes a text row; the text after becomes the next text row.

### PDFs become nested pages (HARD RULE)

If a source report links to a PDF (`<a href="…/foo.pdf">`), do **not** carry that link through to the new site. Instead:

1. Fetch the PDF.
2. Extract text + images from it (via the `pdf` skill, `pdfjs-dist`, or Puppeteer).
3. Create a **nested page** under the parent report (path: `<parent-report-path>/<pdf-slug>`) populated with the extracted text + images, following the same image-as-row-boundary rule.
4. Replace the original PDF link in the parent report with a markdown link to the nested page (relative path).

This applies to AGM minutes, agendas, walk programmes, risk assessments — anything that historically lived as a PDF download.

### Don't duplicate what the index page already provides (HARD RULE)

Aggregator pages (year folders, landing pages with `album-index`) auto-generate their own header text and breadcrumb-driven back navigation. Adding an extra `text` row with `# 2021` at the top duplicates the heading (you'll see "2021" rendered twice — once from the album-index `autoTitle`, once from your text row). Adding a "Back to …" `action-buttons` row at the bottom duplicates the breadcrumb that NGX renders automatically.

Concretely on landing/year pages:

- **Don't** add a leading `text` row with the page heading. Set `albumIndex.autoTitle: true` and let it derive the heading from the path.
- **Don't** add a trailing `action-buttons` row labelled "Back to …". The breadcrumb already provides this.
- **Do** keep the migrated-from footer row.

Minimal aggregator page = `[album-index, migrated-from]`. Two rows. That's it.

The same applies to `events` landing-style pages: the events row + migrated-from. No extra heading, no back button.

### Galleries follow `gallery/{year}/{album-slug}` (HARD RULE)

When migrating photo galleries, use the year-nested pattern:

```
gallery (landing — album-index, sort desc)
  gallery/2025 (year landing — album-index of that year's albums, sort desc)
    gallery/2025/may-white-cliffs-of-dover (leaf — album row with the actual photos)
```

This lets the index pages be navigated down by year, and new albums are added under the appropriate year without restructuring.

Notes:
- WordPress NextGEN Gallery plugin (`ngg_shortcode_N_placeholder`) is opaque: gallery data lives in a private plugin DB table, not the WP REST API. To migrate from a NextGEN source, scrape the rendered gallery pages with Puppeteer rather than relying on the REST API.
- The NGX `album` row type is the leaf-page format; the parent year/landing pages use `album-index` rows.
- Match the source navbar label exactly — if the source called it "Gallery", call it "Gallery" in the new navbar (not "Photos").

### Authentic source navbar mirroring (HARD RULE)

The new navbar must mirror the source navbar's structure and labels, not impose NGX defaults. Steps:

1. Fetch the source homepage and extract the menu verbatim (top-level items + sub-items).
2. For each source nav item, decide whether it has a real-world equivalent in NGX. Don't drop authentic items just because NGX doesn't ship a default for them; create the page.
3. Don't add tabs that didn't exist on the source (e.g. "About Us", "How-To") just because NGX defaults include them.
4. Preserve the source's labels: "Reports" not "News", "Gallery" not "Photos", "Contact" not "Contact Us", etc.
5. The same applies to the navbar's right-hand quick-link buttons — typically include "National Ramblers" plus a "Current Site" link back to the legacy URL while migration is in progress.

A migration that imposes NGX defaults rather than mirroring the source is a failed migration, no matter how many pages got moved.

### Contact-us form recipient list (HARD RULE)

WordPress contact pages typically embed a form with a recipient drop-down. The recipient list is **authentic source data** worth lifting:

1. Parse `<option value="…">Label</option>` pairs from the WP `contact` page's `content.rendered`.
2. Drop the form HTML itself (NGX has its own `contact-form` row).
3. Render the recipient list as a follow-up text row beneath the contact-form row, so visitors can see which roles the form routes to.

Lift the recipient labels from the source page's `<option>` list. Do not invent roles.

### Migrated-from footer row (HARD RULE)

Every migrated page must end with an attribution row pointing back to the source URL the content was lifted from, with the date of migration. Format:

```json
{
  "type": "text", "maxColumns": 1, "showSwiper": false, "marginTop": 3,
  "columns": [{
    "columns": 12, "accessLevel": "public",
    "contentText": "Automatically migrated from <SOURCE_URL> on <YYYY-MM-DD HH:MM>"
  }]
}
```

This includes:
- Leaf pages (one report → one URL)
- Aggregator landing pages (`news/reports`, `walks/walking-advice`) — point at the closest source equivalent (e.g. `https://oldsite.org.uk/reports/`)
- The home page — point at the source root URL

Per `feedback_preserve_migrated_from.md`, **never modify or strip these rows on subsequent edits.** They serve as provenance for the editor doing the manual cleanup pass.

### Date-prefixed slugs for date-ordered content (HARD RULE)

For content that has a meaningful date (reports, news posts, walk write-ups), prefix the slug with `YYYY-MM-DD` so alphabetical sorting on `href` produces date order:

- `news/reports/2025/2025-02-07-fishy-quiz` ✓ (sorts correctly)
- `news/reports/2025/fishy-quiz-february-7th-2025` ✗ (sorts alphabetically, not by date)

Combine with `albumIndex.sortConfig: { field: "href", direction: "desc" }` to put most-recent first in the index.

For non-date-ordered content (walking advice, reference pages), keep the source slug — but if the source already uses numeric prefixes for ordering (`10-about-our-walks`, `20-what-to-wear`), preserve them and use `direction: "asc"` for the index.

### Ramblers Event Type values (documented enum)

The `events` row's `eventTypes` array uses values from `RamblersEventType` (in `projects/ngx-ramblers/src/app/models/ramblers-walks-manager.ts`):

- `"group-walk"` — group walks (the walks programme)
- `"group-event"` — social events / group events (NOT `"social-event"`)
- `"wellbeing-walk"` — Ramblers Wellbeing Walks

Use `"group-event"` for the Social Events landing page. `"social-event"` is invalid and renders an empty selection in the admin.

### Navbar / Page Hierarchy Constraint (HARD RULE)

Every page in the new environment must **hang below a top-level navbar tab**. The navbar is the only top-level entry point — orphan paths that don't sit under a tab are not navigable.

- **Step 1**: Decide the tab list before creating any pages. Map every category of content from the source site to one of the new tabs (remap as needed — don't copy the source navbar literally; the goal is that *all source content finds a home* in the new navbar).
- **Step 2**: Configure `header.navigationPages` in the system config first.
- **Step 3**: Every page path you then create must have its first segment match one of the tab `href` values. e.g. with a `news` tab, `news/reports/2024/foo` is valid; `reports/2024/foo` is not.
- Common NGX tabs and the path roots they cover:
  - `Home` → `#home-content`
  - `About Us` → `about-us`
  - `Walks` → `walks` (covers walks-programme [auto from Walks Manager], walking-advice, risk-assessment, documents)
  - `Social Events` → `social-events` (auto)
  - `News` → `news` (covers reports/, announcements/)
  - `Photos` → `photos` (covers galleries/albums)
  - `Contact Us` → `contact-us`
  - `How-To` → `how-to` (committee help docs)
  - `Admin` → `admin` (system; non-public)

Set the navbar via:
```bash
# Read current config
curl -s "https://<env>/api/database/config?key=system" -H "Authorization: Bearer $AUTH" > /tmp/system.json

# Patch header.navigationPages, then POST back the modified config under {key:"system", value:<modified>}
```

### Walks programme is never reproduced

NGX pulls walks live from Ramblers Walks Manager once the area+group code is configured (read them from this site's system config). Do not migrate walk-programme listing pages from the source — they are redundant and will conflict with the live data.

### Cross-references to walks (post-2023)

When a migrated page references an actual walk that took place from 2023-01-01 onwards (the cut-off where Walks Manager sync covers the data), rewrite the reference as a markdown link to the **internal NGX walk path** using a relative URL.

- Extract the walk date from the source content (title or first paragraph).
- Look up the matching synced event via the env's `extendedgroupevents` API by date + group code.
- Replace the prose date or source-site walk URL with the relative NGX path.
- Pre-2023 references stay as plain text — the walks aren't in the events store and any link would 404.
- Source links pointing at walk-programme archive pages (which are out of scope) get unwrapped to plain text rather than rewritten.

### NEVER do these
- Don't touch `admin#action-buttons` — pre-configured, will break admin
- Don't manually create walks/events — they sync from Ramblers API
- Don't use `"GROUP_WALK"` — event types MUST be lowercase: `"group-walk"`
- Don't use string tags in content metadata — `tags` array expects number indices, use `[]`
- Don't use markdown image syntax (`![](url)`) for hero images — use `imageSource` + `showTextAfterImage`
- Don't overwrite pages the user has manually edited via the CMS editor
- Don't create pages whose first path segment doesn't match a navbar tab `href` — they will be unreachable

### ALWAYS do these
- Use `createOrUpdatePageContent` (upsert) to avoid duplicate path errors
- Include `id` in the body when using PUT to update
- Use `accessLevel: "public"` for all public-facing content
- Use `album-index` on parent pages to auto-generate navigation to child pages
- Confirm the migration plan with the user before creating pages
- Use dates in milliseconds (not ISO strings)
- Use UK English in all content

## GPX Route and Map Migration

Many legacy Ramblers sites have walking routes, mapping pages, or GPX downloads. These should be migrated into **map row types**.

### Discovery
- Scrape the old site for `.gpx` file links, embedded maps, or mapping pages
- Download GPX files locally for upload
- Note any route names, descriptions, and groupings

### Upload GPX Files
GPX files are uploaded to S3 via the server API:

```bash
curl -s -X POST https://<new-site>/api/database/walks/gpx/upload \
  -H "Authorization: Bearer $AUTH" \
  -F "file=@/path/to/route.gpx"
```

Returns `ServerFileNameData` with `awsFileName`, `originalFileName`, `startLat`, `startLng`.

### Create Map Pages
After uploading, create a page with a map row referencing the uploaded GPX files:

```typescript
const mapPage = {
  path: "walks/mapping/walking-routes",
  rows: [{
    type: PageContentType.MAP,
    showSwiper: false,
    maxColumns: 1,
    columns: [{ columns: 12, accessLevel: "public" }],
    map: {
      routes: uploadedRoutes.map(r => ({
        id: generateUid(),
        name: r.originalFileName.replace(".gpx", ""),
        gpxFile: { rootFolder: "gpxRoutes", awsFileName: r.awsFileName, originalFileName: r.originalFileName },
        color: "GREEN",
        visible: true,
        weight: 3,
        opacity: 0.8
      })),
      markers: [],
      mapHeight: 500,
      autoFitBounds: true,
      provider: "osm",
      showControlsDefault: true,
      allowControlsToggle: true,
      showWaypointsDefault: false,
      allowWaypointsToggle: true
    }
  }]
};
```

### ESRI/Shapefile Import
For groups with shapefile data (e.g. rights of way, parish boundaries):
- Upload via `/api/database/map-routes/import` with the ZIP file
- Features are grouped by `StatusDesc` property
- Each group becomes a separate GPX file with a distinct colour
- Coordinate transformation from British National Grid (EPSG:27700) to WGS84 is handled automatically

### Map Provider Options
- `"osm"` — OpenStreetMap (default, free)
- `"os"` — Ordnance Survey Maps (UK-specific, requires API key configured in system settings)

## Image Handling

### During migration
- Reference old site image URLs directly as `imageSource` — they work as external URLs
- This lets you migrate content first, images later

### Image migration to S3 (later)
- Use the admin UI at `/admin/image-migration` to bulk-migrate external images to S3
- Or images can be re-uploaded through the CMS editor

## Page Hierarchy Pattern

```
navbar-page/                    ← album-index row auto-generates nav to children
  navbar-page/sub-page-1       ← text content
  navbar-page/sub-page-2       ← text content
  navbar-page/sub-section/     ← album-index row for deeper nesting
    navbar-page/sub-section/child-1
```

Use `album-index` with `contentPaths: [{contentPath: "parent/", stringMatch: "starts-with", maxPathSegments: 1}]` on parent pages.

## Existing Tools

- **CLI**: `ngx-cli migrate reconcile|apply|interactive` — automated scrape + reconcile + apply
- **Scraping engine**: `server/lib/migration/migrate-static-site-engine.ts` — Puppeteer-based
- **Transform engine**: `server/lib/migration/page-transformation-engine.ts` — HTML→Markdown→PageContent
- **CMS client**: `server/lib/shared/cms-client.ts` — programmatic REST API client
- **Environment setup wizard**: `/admin/environment-management/setup` — provisions new environments (Fly.io app, database, S3, DNS)
