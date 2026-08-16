import { Request, Response } from "express";
import vm from "vm";
import { isArray, isNumber, isObject, isString } from "es-toolkit/compat";
import debug from "debug";
import { envConfig } from "../env-config/env-config";
import {
  RamblersLibraryRoute,
  RouteFollowPoint,
  RouteFollowWaypoint,
  RouteWaypointKind
} from "../../../projects/ngx-ramblers/src/app/models/route-follow.model";
import { generateUid } from "../../../projects/ngx-ramblers/src/app/functions/numbers";

const debugLog = debug(envConfig.logNamespace("ramblers:library-route"));
debugLog.enabled = false;

const RAMBLERS_ROUTE_HOSTS = ["www.ramblers.org.uk", "ramblers.org.uk"];
const ROUTE_PATH_PREFIX = "/go-walking/routes/";
const BROWSER_USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

export function ramblersRouteSlugFrom(value: string | null | undefined): string | null {
  if (!isString(value) || value.trim().length === 0) {
    return null;
  } else {
    const trimmed = value.trim();
    if (!trimmed.includes("/") && !trimmed.includes(".")) {
      return toRouteSlug(trimmed);
    } else {
      try {
        const withProtocol = trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://www.ramblers.org.uk${trimmed.startsWith("/") ? "" : "/"}${trimmed}`;
        const parsed = new URL(withProtocol);
        const hostAllowed = RAMBLERS_ROUTE_HOSTS.includes(parsed.hostname.toLowerCase());
        const path = parsed.pathname.replace(/\/+$/, "");
        if (hostAllowed && path.startsWith(ROUTE_PATH_PREFIX)) {
          return toRouteSlug(path.slice(ROUTE_PATH_PREFIX.length));
        } else {
          return null;
        }
      } catch (error) {
        debugLog("ramblersRouteSlugFrom: failed to parse", value, error);
        return null;
      }
    }
  }
}

export async function lookupLibraryRoute(req: Request, res: Response): Promise<void> {
  const raw = (req.query.url || req.query.slug) as string;
  const slug = ramblersRouteSlugFrom(raw);
  if (!slug) {
    res.status(400).json({
      action: "query",
      message: "Paste a Ramblers route link such as https://www.ramblers.org.uk/go-walking/routes/egerton-kent"
    });
  } else {
    try {
      const route = await libraryRouteForSlug(slug);
      res.status(200).json({action: "query", response: route});
    } catch (error) {
      debugLog("lookupLibraryRoute failed", error);
      res.status(404).json({
        action: "query",
        message: error instanceof Error ? error.message : "That Ramblers route could not be loaded"
      });
    }
  }
}

export async function libraryRouteForSlug(slug: string): Promise<RamblersLibraryRoute> {
  const sourceUrl = `https://www.ramblers.org.uk${ROUTE_PATH_PREFIX}${slug}`;
  const html = await fetchRamblersHtml(sourceUrl);
  const payload = nuxtPayloadFrom(html);
  const page = firstRoutePage(payload);
  if (!page) {
    throw new Error("The Ramblers page did not contain a route");
  } else {
    return libraryRouteFromPage(page, slug, sourceUrl);
  }
}

export function libraryRouteFromPage(page: Record<string, any>, slug: string, sourceUrl: string): RamblersLibraryRoute {
  const content = isObjectRecord(page.content) ? page.content : {};
  const start = startFrom(page, content);
  const instructionWaypoints = waypointsFromInstructions(content.instructions);
  const points = pointsFromGeometry(content.geojson || page.geoJsonData || page.geoDataGpx || content.gpx);
  const startWaypoint: RouteFollowWaypoint = {
    id: generateUid(),
    latitude: start.latitude,
    longitude: start.longitude,
    label: "Start",
    instruction: start.description || "Start here",
    kind: RouteWaypointKind.START
  };
  const waypoints = instructionWaypoints.length > 0 ? instructionWaypoints : [startWaypoint];
  return {
    slug,
    title: asText(page.title) || titleFromSlug(slug),
    description: asText(page.description) || asText(content.description) || "",
    startDescription: start.description,
    startLatitude: start.latitude,
    startLongitude: start.longitude,
    distanceMiles: milesFrom(page, content),
    durationMinutes: isNumber(content.duration) ? content.duration : null,
    difficulty: asText(content.difficulty),
    shape: asText(content.shape),
    sourceUrl,
    points,
    waypoints,
    hasLine: points.length >= 2
  };
}

export function nuxtPayloadFrom(html: string): any {
  const marker = "window.__NUXT__=";
  const start = html.indexOf(marker);
  if (start < 0) {
    throw new Error("The Ramblers page did not contain route data");
  } else {
    const scriptEnd = html.indexOf("</script>", start);
    const expr = html.slice(start + marker.length, scriptEnd >= 0 ? scriptEnd : undefined).trim().replace(/;+$/, "");
    const sandbox: {data: any} = {data: null};
    const script = new vm.Script(`data = ${expr}`);
    script.runInNewContext(sandbox, {timeout: 1500});
    return sandbox.data;
  }
}

function firstRoutePage(payload: any): Record<string, any> | null {
  const pages = isArray(payload?.data) ? payload.data : [];
  const match = pages.find((item: any) => isObjectRecord(item) && (item.type === "route" || item.slug || item.content));
  return match || null;
}

function startFrom(page: Record<string, any>, content: Record<string, any>): {latitude: number; longitude: number; description: string} {
  const location = isObjectRecord(content.start_location) ? content.start_location : {};
  const latitude = asCoordinate(page.startLatitude) ?? asCoordinate(location.latitude) ?? asCoordinate(page.latitude);
  const longitude = asCoordinate(page.startLongitude) ?? asCoordinate(location.longitude) ?? asCoordinate(page.longitude);
  if (latitude === null || longitude === null) {
    throw new Error("This Ramblers route does not publish a start location");
  } else {
    return {
      latitude,
      longitude,
      description: asText(page.startDescription) || asText(location.description) || asText(location.short_description) || ""
    };
  }
}

function milesFrom(page: Record<string, any>, content: Record<string, any>): number | null {
  const rawMiles = page.milesValue;
  if (isString(rawMiles) && rawMiles.length > 0) {
    const parsed = parseFloat(rawMiles);
    return isNaN(parsed) ? null : parsed;
  } else if (isNumber(content.distance)) {
    return parseFloat((content.distance / 1.60934).toFixed(1));
  } else {
    return null;
  }
}

function waypointsFromInstructions(value: any): RouteFollowWaypoint[] {
  if (!isArray(value)) {
    return [];
  } else {
    return value.map((item, index) => instructionWaypoint(item, index)).filter((item): item is RouteFollowWaypoint => !!item);
  }
}

function instructionWaypoint(item: any, index: number): RouteFollowWaypoint | null {
  const latitude = asCoordinate(item?.latitude) ?? asCoordinate(item?.lat) ?? asCoordinate(item?.location?.latitude) ?? asCoordinate(item?.location?.lat);
  const longitude = asCoordinate(item?.longitude) ?? asCoordinate(item?.lng) ?? asCoordinate(item?.lon) ?? asCoordinate(item?.location?.longitude) ?? asCoordinate(item?.location?.lng);
  if (latitude === null || longitude === null) {
    return null;
  } else {
    return {
      id: generateUid(),
      latitude,
      longitude,
      label: asText(item?.name) || asText(item?.title) || String(index + 1),
      instruction: asText(item?.instruction) || asText(item?.text) || asText(item?.description) || asText(item?.content),
      kind: index === 0 ? RouteWaypointKind.START : RouteWaypointKind.WAYPOINT
    };
  }
}

function pointsFromGeometry(value: any): RouteFollowPoint[] {
  if (!value) {
    return [];
  } else if (isString(value) && value.trim().startsWith("{")) {
    try {
      return pointsFromGeometry(JSON.parse(value));
    } catch (error) {
      debugLog("pointsFromGeometry: json parse failed", error);
      return [];
    }
  } else if (isString(value) && value.includes("<trkpt")) {
    return pointsFromGpx(value);
  } else if (isObjectRecord(value)) {
    return pointsFromGeoJson(value);
  } else {
    return [];
  }
}

function pointsFromGeoJson(value: Record<string, any>): RouteFollowPoint[] {
  const geometry = isObjectRecord(value.geometry) ? value.geometry : value;
  const type = asText(geometry.type);
  const coordinates = geometry.coordinates;
  if (type === "LineString" && isArray(coordinates)) {
    return coordinates.map(pair => pointFromPair(pair)).filter((item): item is RouteFollowPoint => !!item);
  } else if (type === "MultiLineString" && isArray(coordinates)) {
    return coordinates.reduce((acc: RouteFollowPoint[], line: any) => {
      const extra = isArray(line) ? line.map(pair => pointFromPair(pair)).filter((item): item is RouteFollowPoint => !!item) : [];
      return [...acc, ...extra];
    }, []);
  } else if (type === "FeatureCollection" && isArray(value.features)) {
    return value.features.reduce((acc: RouteFollowPoint[], feature: any) => [...acc, ...pointsFromGeoJson(feature)], []);
  } else if (type === "Feature") {
    return pointsFromGeoJson(geometry);
  } else {
    return [];
  }
}

function pointsFromGpx(gpx: string): RouteFollowPoint[] {
  const matches = gpx.matchAll(/<trkpt[^>]*lat="([^"]+)"[^>]*lon="([^"]+)"/g);
  return Array.from(matches).map(match => {
    const latitude = parseFloat(match[1]);
    const longitude = parseFloat(match[2]);
    return isNaN(latitude) || isNaN(longitude) ? null : {latitude, longitude};
  }).filter((item): item is RouteFollowPoint => !!item);
}

function pointFromPair(pair: any): RouteFollowPoint | null {
  if (!isArray(pair) || pair.length < 2) {
    return null;
  } else {
    const longitude = asCoordinate(pair[0]);
    const latitude = asCoordinate(pair[1]);
    return latitude === null || longitude === null ? null : {latitude, longitude};
  }
}

async function fetchRamblersHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": BROWSER_USER_AGENT,
      Accept: "text/html,application/xhtml+xml"
    }
  });
  if (!response.ok) {
    throw new Error(`Ramblers returned ${response.status} for that route`);
  } else {
    return response.text();
  }
}

function toRouteSlug(value: string): string | null {
  const slug = value.split(/[?#]/)[0].split("/").filter(item => item).pop() || "";
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug) ? slug.toLowerCase() : null;
}

function titleFromSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, character => character.toUpperCase());
}

function asText(value: any): string | null {
  return isString(value) && value.trim().length > 0 ? value.trim() : null;
}

function asCoordinate(value: any): number | null {
  if (isNumber(value) && !isNaN(value)) {
    return value;
  } else if (isString(value) && value.trim().length > 0) {
    const parsed = parseFloat(value);
    return isNaN(parsed) ? null : parsed;
  } else {
    return null;
  }
}

function isObjectRecord(value: any): value is Record<string, any> {
  return isObject(value) && !isArray(value);
}
