# Content Export API

A public, stateless API that returns the publicly visible content of CMS pages in machine-readable formats. No authentication is required - only content already visible to anonymous site visitors is returned, and pages whose content is entirely restricted to members or committee respond with `404`.

## Endpoints

```
GET /api/public/content/path/<urlPath>
GET /api/public/content/<pageId>
GET /api/public/releases
GET /api/releases.json
```

- `<urlPath>` is the page's site path, e.g. `contact-us` or `how-to/committee/release-notes`
- `<pageId>` is the page's database id
- `/api/public/releases` and `/api/releases.json` are the same self-describing release feed

## Query parameters

| Parameter | Values | Default | Effect |
|-----------|--------|---------|--------|
| `format` | `json`, `html`, `markdown` | `json` | Response body format (content endpoints) |
| `limit` | positive integer (max 200) | `50` | Max entries in the release feed |

## Examples

```bash
curl https://www.example-site.org.uk/api/public/content/path/contact-us
curl "https://www.example-site.org.uk/api/public/content/path/how-to/committee/release-notes?format=markdown"
curl "https://www.example-site.org.uk/api/public/content/path/home?format=html"
curl https://www.example-site.org.uk/api/public/releases
curl "https://www.example-site.org.uk/api/public/releases?limit=10"
```

Page addresses answer directly too - adding `?format=` to any CMS page address returns its content instead of the app:

```bash
curl "https://www.example-site.org.uk/contact-us?format=markdown"
```

An unknown format or a non-CMS address falls through to the normal page.

JSON response shape for a CMS page:

```json
{
  "id": "65f1c0ffee0123456789abcd",
  "title": "Contact Us",
  "path": "contact-us",
  "contentMarkdown": "## Get in touch\n\n...",
  "contentHtml": "<h2>Get in touch</h2><p>...</p>"
}
```

JSON response shape for the release feed:

```json
{
  "title": "Example Group Release Notes",
  "description": "Recent releases of Example Group, newest first",
  "type": "release-feed",
  "generated": "2026-07-27T10:00:00.000+01:00",
  "indexPath": "how-to/committee/release-notes",
  "indexUrl": "https://www.example-site.org.uk/how-to/committee/release-notes",
  "humansIndexPath": "how-to/committee/release-notes-for-humans",
  "humansIndexUrl": "https://www.example-site.org.uk/how-to/committee/release-notes-for-humans",
  "entries": [
    {
      "title": "26-Jul-2026 — build 796 — #312 — Always set a walk album cover",
      "path": "how-to/committee/release-notes/2026-07-26-issue-312-build-796",
      "url": "https://www.example-site.org.uk/how-to/committee/release-notes/2026-07-26-issue-312-build-796",
      "markdownUrl": "https://www.example-site.org.uk/how-to/committee/release-notes/2026-07-26-issue-312-build-796?format=markdown",
      "jsonUrl": "https://www.example-site.org.uk/how-to/committee/release-notes/2026-07-26-issue-312-build-796?format=json",
      "htmlUrl": "https://www.example-site.org.uk/how-to/committee/release-notes/2026-07-26-issue-312-build-796?format=html",
      "hasImages": false
    }
  ]
}
```

## Behaviour

- Only columns with `PUBLIC` access level (or no access level) are included; nested rows are traversed
- `404` for unknown paths/ids and for pages with no public content
- `400` for an unrecognised `format`
- Responses carry `Cache-Control: public, max-age=300` (release feed and page export) or `max-age=3600` for discovery files

## Server-rendered page metadata

The same renderer feeds the HTML served for every page: `<title>`, `<meta name="description">` and a `<noscript>` copy of the page's public content are injected server-side, so search engines and other tools that do not execute JavaScript can read each page's content. Walk and event pages derive their metadata from the event title and description.

Every page advertises AI discovery entry points that exist on every site:

```html
<link rel="alternate" type="text/plain" title="llms.txt" href="https://www.example-site.org.uk/llms.txt">
<link rel="alternate" type="text/markdown" title="For AI assistants" href="https://www.example-site.org.uk/for-ai">
```

Release-note hubs and the release feed are only advertised when the site's CMS actually contains matching public pages (discovered from the site search index, not invented paths).

Pages backed by CMS content also declare their markdown, HTML and JSON representations:

```html
<link rel="alternate" type="text/markdown" href="https://www.example-site.org.uk/<urlPath>?format=markdown">
<link rel="alternate" type="text/html" href="https://www.example-site.org.uk/<urlPath>?format=html">
<link rel="alternate" type="application/json" href="https://www.example-site.org.uk/<urlPath>?format=json">
```

Matching `Link` HTTP headers are set on the same responses.

## AI discovery

| Path | Purpose |
|------|---------|
| `GET /llms.txt` | Short index for language models ([llms.txt](https://llmstxt.org)) — content-export pattern, CMS-derived hubs and top-level pages |
| `GET /for-ai` | Longer AI landing guide (`?format=markdown` default; also `html`, `json`) |
| `GET /api/public/releases` | Self-describing release feed when a CMS release-notes index exists (also at `/api/releases.json`); otherwise `404` |
| `GET /sitemap.xml` | All public CMS/event page addresses plus `/for-ai` |

Release notes, technical articles and other hubs are taken from each site's public CMS paths. Optional well-known paths (for example `how-to/committee/release-notes` on staging) are promoted only when present; group sites without those pages simply omit them. There are no hard-coded short aliases such as `/release-notes`.

```bash
curl https://www.example-site.org.uk/llms.txt
curl https://www.example-site.org.uk/for-ai
curl "https://www.example-site.org.uk/for-ai?format=json"
curl https://www.example-site.org.uk/api/public/releases
```
