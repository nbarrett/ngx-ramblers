---
name: import-walk-routes
description: Import ESRI shapefile walking routes onto NGX-Ramblers route pages, and build aggregated multi-route overview maps. Use when asked to import shapefiles/GPX routes, put a walk route on a map, convert ESRI/.shp routes, match routes to walk pages, or build a page showing many routes at once. Covers the /api/routes/import-esri endpoint, the page+map structure, BNG→WGS84 reprojection, and geometry-based matching.
argument-hint: <site-url-and-what-to-import>
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebFetch
---

# Import Walk Routes onto NGX-Ramblers

Import ESRI shapefile routes onto walk pages on the **target** site, and build overview maps that show many routes on one canvas. For the CMS data model and `cms-client` API, see the `update-cms-page` and `publish-article` skills. This skill documents the **route-import mechanism**.

## The source data

Shapefile bundles often arrive as an email (`.eml`) with a zip of one shapefile set per route:

- `Route_NNN.shp` (geometry), `.shx` (index), `.dbf` (attributes), `.prj` (projection), `.cpg` (codepage). Some include `.gpx` / `.qmd` / `.qpj` sidecars.
- Coordinates are **British National Grid (EPSG:27700)**, in metres — not lat/long.
- Each `Route_NNN.shp` is typically a PolyLine (shape type 3). Skip empty geometry.

Extract a per-route zip (the import endpoint wants `.shp`+sidecars zipped together) with Python:

```python
import email, io, zipfile
eml = email.message_from_file(open(EML_PATH))
src = next(zipfile.ZipFile(io.BytesIO(p.get_payload(decode=True)))
           for p in eml.walk() if (p.get_filename() or "").lower().endswith(".zip"))
out = zipfile.ZipFile(f"Route_{n:03d}.zip", "w", zipfile.ZIP_DEFLATED)
for e in ["shp","shx","dbf","prj","cpg"]:
    nm = f"Route_{n:03d}.{e}"
    if nm in src.namelist(): out.writestr(nm, src.read(nm))
out.close()
```

## The import endpoint — do NOT re-implement the conversion

The server already converts shapefiles. Drive it; don't hand-roll proj4/togpx.

```
POST {baseUrl}/api/routes/import-esri
  auth:  Authorization: Bearer <token>   (cms-client login() gives the token)
  body:  multipart/form-data, field "file" = the per-route .zip
```

It reprojects BNG→WGS84, simplifies, writes the GPX to S3 `gpx-routes/`, the original zip to S3 `esri-routes/`, and extracts any **point** features as numbered markers. Response:

```json
{ "routeName": "walk_067",
  "gpxFile":  { "rootFolder": "gpx-routes",  "originalFileName": "...", "awsFileName": "<uuid>.gpx" },
  "esriFile": { "rootFolder": "esri-routes", "originalFileName": "...", "awsFileName": "<uuid>.zip" },
  "gpxFiles": [...], "markers": [...],
  "metadata": { "featureCount": 1, "geometryTypes": [...], "sourceCrs": "...", "transformApplied": true } }
```

`metadata` has **no centre/zoom** — compute those yourself from the geometry (below). Call it from a script:

```typescript
const buf = fs.readFileSync(zipPath);
const fd = new FormData();
fd.append("file", new Blob([new Uint8Array(buf)], { type: "application/zip" }), "Route_NNN.zip");
const res = await fetch(`${auth.baseUrl}/api/routes/import-esri`,
  { method: "POST", headers: { Authorization: `Bearer ${auth.authToken}` }, body: fd });
const imp = await res.json();   // { gpxFile, esriFile, markers, metadata }
```

Server code: `server/lib/map-routes/map-route-import.ts` (`importEsriRoute`), wired at `server/lib/map-routes/map-route-routes.ts` → `POST /api/routes/import-esri`.

## Run scripts the documented way

```bash
cd server
CMS_URL="${CMS_URL:-http://localhost:5001}" \
  ../.claude/skills/connect-env-db/scripts/with-cms-login.sh \
  npx tsx <script>
```

`proj4` is in `node_modules` (resolve it by running from the repo, not the scratchpad). The TS "no declaration file for proj4" warning is harmless under tsx.

## Reproject and size the map yourself

BNG (EPSG:27700) → WGS84 for the centre, start point and map sizing:

```typescript
import proj4 from "proj4";
const OSGB = "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=446.448,-125.157,542.06,0.15,0.247,0.842,-20.489 +units=m +no_defs";
const [lng, lat] = proj4(OSGB, "WGS84", [easting, northing]);   // note: proj4 returns [lng, lat]
```

Read the `.shp` PolyLine header bbox (metres) directly without a parser — doubles at byte offsets 36/44/52/60 are Xmin/Ymin/Xmax/Ymax; sum segment lengths for distance; mean of points for the centroid. Length and span are already in metres in BNG (no reprojection needed).

- **Single-route page:** `autoFitBounds: false`, explicit `mapCenter` = centroid (reprojected), `mapZoom` 7 for walks ≥ ~6 mi else 8. Copy zoom/bounds from an existing route page on the target site if one exists.
- **Multi-route overview page:** `autoFitBounds: true`, `mapCenter` = combined-bbox midpoint, `mapZoom: 4.5`, `mapHeight: 900`. The map auto-scales to show every route.

## The route page structure

A single-walk page has these rows — clone from an existing route page on the **target** site if one exists, otherwise:

1. `text` — heading with the walk name + optional banner image (`imageSource`).
2. `location` — `{ location: { start: { latitude, longitude, grid_reference_6, description }, renderingMode: "visible" } }`.
3. `text` two-column — col `8` = nested `[ map row, directions text ]`; col `4` = nested POI rows (`## Points of Interest`, text items, photos). **If there is no POI/photo content, use a single full-width column instead** (an empty `4` column renders as a blank gap).
4. `shared-fragment` — the "report path problems" fragment: `{ fragment: { pageContentId: "<id of that fragment on this site>" } }`. Look the id up on the target site; do not reuse an id from another environment.
5. `text` — `Automatically migrated from <old-url> on <date>`.

The **map row** and **route object**:

```typescript
const route = { id, name, gpxFile: imp.gpxFile, esriFile: imp.esriFile,
  color: "#5a45c6", visible: true, weight: 6, opacity: 1, featureCount: imp.metadata.featureCount };
const mapRow = { type: "map", maxColumns: 1, showSwiper: false,
  columns: [{ columns: 12, accessLevel: "public" }],
  map: { title: "Route map", mapHeight: 500, provider: "os", osStyle: "Leisure_27700",
    showControlsDefault: false, allowControlsToggle: false,
    showWaypointsDefault: true, allowWaypointsToggle: true,
    autoFitBounds: false, mapCenter: [lat, lng], mapZoom, routes: [route], markers: imp.markers } };
```

For a multi-route overview map, push one route object per import with a distinct colour, `weight: 4`, `opacity: 0.85`, give each route a recognisable `name` (location + distance), and add `gpxFile.startLat/startLng`. Route geometry lives in the S3 GPX, fetched at render time — the page document stores only the `gpxFile` reference, never the lat/longs.

## CRITICAL — match by geometry, never trust the route number

The shapefile index (`Route_NNN`) is often a private numbering scheme and **does not** match the website's walk numbers. Number-based matching silently mis-assigns routes. Always verify before attaching old-site copy:

1. Reproject the shapefile centroid → reverse-geocode (Nominatim, ≥1.1 s apart, valid User-Agent) to get the route's real place.
2. Compare against the old page's subject/start-grid. If they disagree, the page is a different walk — do not put its words on this route.
3. Compute the nearest existing published page (haversine vs each page's `mapCenter`). A route within ~200 m of an existing page is probably a duplicate; a route far from anything is genuinely new.
4. Some old sites return HTTP 300 ("Multiple Choices") when the page does **not** exist — that is a miss, not a hit. Decode `windows-1252` if the source is legacy HTML.

Only migrate old-page content when the subject matches the shapefile geometry. Otherwise import the geometry only, or ask the user.
