---
name: create-walk-photos-page
description: Create a walk photo album page on an NGX-Ramblers site, sourcing images from a Facebook post or any list of image URLs or local files. Use when the user shares a Facebook walk post, WhatsApp photos, or any image set and asks for a CMS photo page linked to a walk. Handles walk-event lookup by slug or date, FB photo URL extraction via a logged-in browser, local-file ingestion, album + page creation via cms-client, and optional S3 hosting so the album survives Facebook CDN expiry.
argument-hint: <fb-post-url|walk-date|walk-slug>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent, mcp__Claude_in_Chrome__*
---

# Create Walk Photos Page

You are creating a photo album page on the **target** NGX-Ramblers site for a walk. The output is a CMS page at `<basePath>/<year>/<walk-slug>` with an album row linked to the walk's event record.

Set `basePath` from the target site. Read an existing walk URL or the group's event-type settings (`walkPhotoAlbumBasePath`). Typical values are `walks/photos` or `go-walking/photos`. Do not assume a default from another group.

## Arguments

`$ARGUMENTS` - one of:
- A Facebook post URL (photos are scraped from FB), optionally with the walk slug or date
- The walk slug + a JSON list of image URLs
- A walk date (YYYY-MM-DD) + a list of local image file paths or URLs (e.g. WhatsApp photos in `~/Downloads/`)

## End State

A page at `https://<site>/<basePath>/<year>/<walk-slug>` showing:
- Title: the walk's date (e.g. "Sunday April 26, 2026")
- Subtitle: the walk's title, linked to the walk page
- Pre-album text: the FB post caption (or supplied text)
- Grid of N photos sourced from the FB post

The album record is in `contentMetaData` with `name = <basePath>/<year>/<walk-slug>` and `rootFolder = carousels`. The page row of type `album` references the album by name and links to the walk via `eventId` and `eventDate`.

## Steps

### 1. Look up the walk event - by date or slug

Two ways to identify the walk:

**By date (when the user says "yesterday's walk" or gives a date).** Look up the event whose `groupEvent.start_date_time` falls on that day, prefer `item_type: "group-walk"` if several match, and derive slug + year from the event URL. Put `walkDate: "YYYY-MM-DD"` in the config. **Only safe when this database holds one group's walks** (a contributor bundle does). If the database holds several groups, one date can match many walks: run the date-range query, confirm the event, and pass `walkSlug`.

Date-range query shape:

```bash
curl -s "https://<site>/api/database/group-event/all?criteria=$(printf '%s' '{"groupEvent.start_date_time":{"$gte":"2026-05-03T00:00:00+00:00","$lt":"2026-05-04T00:00:00+00:00"}}' | python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read()))')" | jq '.response[] | {id, date: .groupEvent.start_date_time, title: .groupEvent.title, url: .groupEvent.url, type: .groupEvent.item_type}'
```

Tip: if the user pastes the past-7-days listing URL (`https://<site>/walks?date-range-preset=past-7-days&walk-select-type=past-events`), that's the front-end view of the same data - use the date-range API to pick the matching walk.

**By slug (when the user pastes the walk URL or an existing photo-page URL).** The slug is the trailing path segment of the walk URL. Put `walkSlug` in the config.

```bash
curl -s "https://<site>/api/database/group-event/all?criteria=$(printf '%s' '{"groupEvent.url":{"$regex":"<slug>","$options":"i"}}' | python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.stdin.read()))')" | jq '.response[0] | {id, date: .groupEvent.start_date_time, title: .groupEvent.title}'
```

**Watch for slug collisions.** A photo a recipient took on the route doesn't always identify the walk. If the user's first description matches a different walk than expected, prefer the user's stated date over what the photo content suggests.

A local script using `cms-client` can do both lookups. With `walkDate` it derives slug + year from the event record.

### 2. Extract image URLs from the Facebook post

Facebook actively interferes with browser automation on `www.facebook.com`:
- WebFetch returns nothing useful (login wall + bot blocking).
- `mbasic.facebook.com` redirects back to the full site.
- The Chrome browser MCP often locks up with CDP timeouts on FB pages.
- The MCP redaction layer strips URLs returned via `javascript_tool` because FB CDN URLs look like signed cookie data.

The working pattern:

**a. Open the FB post in the connected (logged-in) Chrome browser tab.** Use a fresh tab created via `tabs_create_mcp` so the FB tab is isolated. If a JS query times out, close the tab via `tabs_close_mcp`, create a new one, and retry.

**b. Click the first photo to enter the lightbox.** This changes the URL to `/photo/?fbid=<id>&set=pcb.<post-id>`. The `set=pcb.<post-id>` is the post's photo set - the post-photo cycle wraps after N photos.

**c. Iterate via the "Next photo" button to harvest fbids.** Use this script in the browser to step through and log each fbid to the console:

```javascript
(async () => {
  const seen = new Set();
  for (let i = 0; i < 50; i++) {
    await new Promise(r => setTimeout(r, 800));
    const m = location.href.match(/fbid=(\d+)/);
    const fbid = m ? m[1] : null;
    if (fbid && seen.has(fbid) && i > 1) break;
    if (fbid) seen.add(fbid);
    console.log("FBID|" + fbid);
    const next = document.querySelector('div[aria-label="Next photo"], a[aria-label="Next photo"]');
    if (!next) { console.log("NO_NEXT_AT_" + i); break; }
    next.click();
  }
  return "captured " + seen.size + " fbids";
})()
```

Read them back with `read_console_messages` filtered on `pattern: "FBID"`.

**d. Resolve each fbid to its full-size image URL via fetch.** The `/photo/?fbid=<id>` route serves an HTML response containing the high-res `t39.30808-6/...` URL. Cross-origin from FB to FB works:

```javascript
window.__r = {};
const fbids = [/* array from step c */];
for (const id of fbids) {
  const r = await fetch('/photo/?fbid=' + id);
  const t = await r.text();
  const matches = Array.from(t.matchAll(/https:\/\/scontent[^"\\]*?t39\.30808-6[^"\\]*?\.jpg[^"\\]*/g));
  const urls = Array.from(new Set(matches.map(m => m[0].replace(/\\\//g, '/'))));
  const matching = urls.filter(u => {
    const idMatch = u.match(/\/(\d+)_(\d+)_/);
    return idMatch && Math.abs(parseInt(idMatch[2]) - parseInt(id)) < 100;
  });
  console.log('PIC_' + id + '|' + (matching[0] || urls[0]));
  await new Promise(r => setTimeout(r, 200));
}
```

The `&amp;` HTML entities in the captured URLs must be decoded to `&` before use - the script does this automatically.

**Why fetch over screen-scrape:** the lightbox image element loads asynchronously and you frequently capture a stale grid thumbnail unless you watch for the asset-id in the URL filename matching the fbid in `location.href`. The fetch approach is deterministic.

### 3. Run the create-walk-photos-page script

```bash
cd server
CMS_URL="${CMS_URL:-http://localhost:5001}" ../.claude/skills/connect-env-db/scripts/with-cms-login.sh npx tsx <script> <config.json>
```

The script takes a single config file argument and must use `cms-client`.

**Config shape - Facebook URLs + slug (original use case):**

```json
{
  "siteUrl": "http://localhost:5001",
  "walkSlug": "<walk-slug>",
  "year": 2026,
  "preAlbumText": "<past-tense write-up>",
  "imageUrls": [
    "https://scontent.fbrs5-1.fna.fbcdn.net/v/t39.30808-6/...",
    "https://scontent.fltn4-1.fna.fbcdn.net/v/t39.30808-6/..."
  ],
  "imagePrefix": "fb",
  "uploadToS3": true
}
```

**Config shape - local files:**

```json
{
  "siteUrl": "http://localhost:5001",
  "basePath": "<from this site's walk photo path>",
  "walkSlug": "<walk-slug>",
  "year": 2026,
  "preAlbumText": "<past-tense write-up>",
  "imageUrls": [
    "/absolute/path/to/photo-1.jpeg",
    "/absolute/path/to/photo-2.jpeg"
  ],
  "imagePrefix": "walk",
  "uploadToS3": true
}
```

**Optional config fields:**
- `basePath` - walks path prefix from this site's settings or an existing walk URL. Do not copy a path from another group.
- `maxImageSize` - omit unless the user asks. The image editor then uses the site-wide default from System Settings (`images.imageLists.defaultMaxImageSize`). `0` means keep full resolution and hide the resize button. The upload API never compresses.

**Prefer `walkSlug` over `walkDate` when the database holds more than one group's walks.** On a single-group database (contributor bundle), `walkDate` is safe. On a multi-group database, look up the event (date-range query in step 1), confirm it, and pass `walkSlug`.

The script:
1. Looks up the walk event by `walkDate` (preferred) or `walkSlug`, via `groupEventsByDate()` / `groupEventBySlug()` from the cms-client. With `walkDate` it filters to `item_type: "group-walk"` if multiple events fall on that day, and derives slug + year from the event's URL field.
2. Logs in via `login()` from the cms-client.
3. Materialises each `imageUrls` entry to S3 via `uploadFileToS3()` if `uploadToS3: true`. Entries can be remote URLs (fetched), absolute file paths starting with `/`, or `file://` URLs (read from disk). Skip S3 upload if the user is going to use the admin content-migration tool.
4. Creates or updates the album via `createOrUpdateContentMetadata()`.
5. Creates or updates the page-content row via `createOrUpdatePageContent()`.

**Iterating without re-uploading.** When `uploadToS3: false` and an album with the matching name already exists with the same file count, the script reuses the existing S3 references. This means you can edit `preAlbumText` and re-run the script as many times as you like without re-paying upload bandwidth. Use `uploadToS3: true` only on the first run, or when the photo set changes.

For local files (WhatsApp, photos taken on phone), `uploadToS3: true` is the right default on the first run because there's no remote URL to fall back on.

### 3c. Always go through cms-client - never hand-roll fetches

NGX has a complete public API at `/api/database/...` and `/api/aws/s3/...`. The trusted facade for skills/scripts is `server/lib/shared/cms-client.ts` - all walk-photo work goes through it:

| Operation | cms-client export |
|---|---|
| Look up a walk by slug | `groupEventBySlug(baseUrl, slug)` |
| Look up walks on a date | `groupEventsByDate(baseUrl, isoDate)` |
| Generic walk-event criteria query | `groupEventsByCriteria(baseUrl, criteria)` |
| Find an album record by name | `contentMetadataByName(auth, name)` |
| Upsert an album | `createOrUpdateContentMetadata(auth, body)` |
| Upload bytes to S3 | `uploadFileToS3(auth, bytes, filename, rootFolder)` |
| Get / create / update / delete a page | `pageContent`, `createPageContent`, `updatePageContent`, `createOrUpdatePageContent`, `deletePageContent` |

Do NOT add ad-hoc `fetch()` calls in scripts. If you need a new operation (e.g. read banners, write notification configs), add a helper to cms-client first, then use it. This keeps every skill on the same trusted path and means a future schema or routing change updates one file, not many.

### 3a. Writing the preAlbumText (past-tense write-up)

The convention on existing pages is a short past-tense narrative of the route. Two ways to source it:

1. **If the user supplied a write-up or FB caption** - use it verbatim (lightly tidied if needed).
2. **Otherwise default to a past-tense rewrite of the walk's `groupEvent.description`.** The description on the walk event is written for prospective walkers (present/future tense, parking prices, "we meet at..."). Convert it: "we meet" -> "we met", "we head" -> "we headed", drop pre-walk logistics (parking price, "all day weekend parking is £x"), turn post-walk venue suggestions into a finishing note ("finished at the cafe just yards from the car park").

Match the tone of existing album pages **on the target site** if any exist: short, past tense, route-focused. Follow `unslop` / `AGENTS.md` for prose. Drop pre-walk logistics (parking prices, meeting instructions).

### 4. Image expiry warning

Facebook CDN URLs carry a signed `oh=` token and an `oe=` expiry. The `oe=` value is a Unix epoch in hex: e.g. `oe=69FD7445` decodes to roughly **5 days from when you grabbed it**. After that the image 404s.

Two ways to make the page permanent:
- **`uploadToS3: true` in the config** - the script downloads each FB URL (must be done while tokens are still valid) and re-hosts under the site's S3 carousels folder. Album record stores just the S3 filename in `image`, with `rootFolder: "carousels"`. **The script uploads to `carousels/<albumName>/<uuid>.jpg`** because the frontend builds image URLs as `/api/aws/s3/<rootFolder>/<albumName>/<image>` - uploading to plain `carousels/` (without the album-name subfolder) gives 404s for every image.
- **Admin content-migration tool** - `/admin/image-migration` re-hosts external URLs to S3. Use this when the user wants to migrate in the UI rather than in the script.

The page can ship with raw FB URLs initially (works for a few days) and be migrated to S3 before the tokens lapse.

## Default Grid Layout

Default grid view:
- `albumView: "grid"`
- `layoutMode: "masonry"` (not justified)
- `maxColumns: 2`
- `imageFit: "contain"`
- `gap: 0.5`, `borderRadius: 6`

## Reference Implementation

- Copy layout from an existing album page on the **target** site if one exists.
- Drive create/update through `cms-client`, not ad-hoc `fetch`.

## Publishing the album to Facebook and Instagram (#16)

Once the album exists, it can be published to the site's Facebook Page and Instagram account **from the NGX UI**, not from this script. In the image-list (album) editor, the **Share album to social media** panel lets you pick images, write a caption, and post a multi-photo Facebook post plus an Instagram carousel in one step. It reuses the S3-hosted album images (public URLs are exactly what Instagram's API needs) and records each post so it is not sent twice.

This is only available once an admin has connected the Page in **System Settings → External Systems → Social Media**. Per-network publishing is off until that is done. The server endpoints are under `/api/social` — do not hand-roll Graph API calls in scripts.

## Don'ts

- **Don't** run the script in the browser via `javascript_tool` POST loops - the page reloads mid-flight and loses fetch state. Use the TypeScript script + cms-client.
- **Don't** scrape FB via WebFetch - it returns nothing useful.
- **Don't** mix `&amp;` entities into the album JSON - decode to `&` (the script does this).
- **Don't** assume FB URLs work forever - they expire within days. Use `uploadToS3: true` or the admin migration tool before they lapse.
- **Don't** modify the walk event record - the photos page only reads it.

## Creating the album in-app (#312)

The same records can be created in the NGX UI: on a walk, a walk admin clicks **photo album** to create the album + page and open the album editor. The path prefix is per-site under **Admin → System Settings → Group / Area** event-type settings: walk `walkPhotoAlbumBasePath` and social `socialPhotoAlbumBasePath` (blank follows the nav, or a custom prefix). Full path: `<basePath>/<year>/<slug>`. Layout comes from the site's `fragments/templates/walk-album` user template (seeded on first use). When AI text generation is on under Environment Management, the pre-album text is rewritten as a past-tense report from the walk description; when it is off, the description is used as-is. Use a script for bulk/Facebook/local files; use the in-app button for a single walk.
