# Content Export API

A public, stateless API that returns the publicly visible content of CMS pages in machine-readable formats. No authentication is required - only content already visible to anonymous site visitors is returned, and pages whose content is entirely restricted to members or committee respond with `404`.

## Endpoints

```
GET /api/public/content/path/<urlPath>
GET /api/public/content/<pageId>
```

- `<urlPath>` is the page's site path, e.g. `contact-us` or `how-to/committee/release-notes`
- `<pageId>` is the page's database id

## Query parameters

| Parameter | Values | Default | Effect |
|-----------|--------|---------|--------|
| `format` | `json`, `html`, `markdown` | `json` | Response body format |

## Examples

```bash
curl https://www.example-site.org.uk/api/public/content/path/contact-us
curl "https://www.example-site.org.uk/api/public/content/path/how-to/committee/release-notes?format=markdown"
curl "https://www.example-site.org.uk/api/public/content/path/home?format=html"
```

Page addresses answer directly too - adding `?format=` to any CMS page address returns its content instead of the app:

```bash
curl "https://www.example-site.org.uk/contact-us?format=markdown"
```

An unknown format or a non-CMS address falls through to the normal page.

JSON response shape:

```json
{
  "id": "65f1c0ffee0123456789abcd",
  "title": "Contact Us",
  "path": "contact-us",
  "contentMarkdown": "## Get in touch\n\n...",
  "contentHtml": "<h2>Get in touch</h2><p>...</p>"
}
```

## Behaviour

- Only columns with `PUBLIC` access level (or no access level) are included; nested rows are traversed
- `404` for unknown paths/ids and for pages with no public content
- `400` for an unrecognised `format`
- Responses carry `Cache-Control: public, max-age=300`

## Server-rendered page metadata

The same renderer feeds the HTML served for every page: `<title>`, `<meta name="description">` and a `<noscript>` copy of the page's public content are injected server-side, so search engines and other tools that do not execute JavaScript can read each page's content. Walk and event pages derive their metadata from the event title and description.

Pages backed by CMS content also declare their markdown export for tool discovery:

```html
<link rel="alternate" type="text/markdown" href="/api/public/content/path/<urlPath>?format=markdown">
```

## llms.txt

Each site serves `GET /llms.txt` - a plain-text guide for AI tools following the [llms.txt convention](https://llmstxt.org). It names the site, explains the content export URL pattern, points at the sitemap and lists the site's top-level pages.
