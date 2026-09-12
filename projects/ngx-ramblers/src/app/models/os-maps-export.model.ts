import { FileNameData, ServerFileNameData } from "./aws-object.model";

export enum OsMapsRouteSource {
  CREATED = "created",
  BOOKMARKED = "bookmarked"
}

export enum OsMapsRouteListFilter {
  ALL = "all",
  IMPORTED = "imported",
  NOT_IMPORTED = "not-imported"
}

export interface OsMapsListedRoute {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  createdAtValue: number;
  distanceMetres: number;
  source: OsMapsRouteSource;
  importedAt?: number | null;
  gpxFile?: FileNameData | null;
  routeColor?: string | null;
  routeWeight?: number | null;
  routeOpacity?: number | null;
}

export interface OsMapsRouteListing {
  listedAt: number;
  routes: OsMapsListedRoute[];
}

export interface OsMapsRouteFixture {
  id: number;
  name: string;
  url: string;
  expectedDistanceKm: number;
  minimumTrackPoints: number;
  minimumWaypoints: number;
  distanceToleranceKm: number;
}

export interface ExportedGpxSummary {
  routeId?: string | null;
  fileName: string;
  content: string;
  name: string;
  creator: string;
  trackPointCount: number;
  waypointCount: number;
  totalDistanceMetres: number;
  totalDistanceKm: number;
  startLat: number;
  startLng: number;
}

export enum OsMapsExportJobStatus {
  QUEUED = "queued",
  COMPLETED = "completed",
  FAILED = "failed"
}

export interface PersistedOsMapsGpx {
  summary: ExportedGpxSummary;
  gpxFile: ServerFileNameData;
}

export interface OsMapsRouteImport {
  url: string;
  gpxFile: FileNameData;
}

export interface OsMapsExportJobResult {
  jobId: string;
  fileName: string;
  status: OsMapsExportJobStatus;
  walkId?: string | null;
  routeUrls?: string[];
  gpxFiles: FileNameData[];
  error?: string | null;
  createdAt: number;
  completedAt?: number | null;
}

export enum OsMapsPageState {
  UNRECOGNISED = "unrecognised",
  AUTHENTICATED = "authenticated",
  LOGIN_REQUIRED = "loginRequired",
  IDENTITY_PROVIDER = "identityProvider",
  ROUTE_UNAVAILABLE = "routeUnavailable"
}

export const OS_MAPS_ROUTE_UNAVAILABLE_TITLE = "Route unavailable";

export const OS_MAPS_IDENTITY_URL_PATTERN = /b2clogin|microsoftonline|osinfra/i;

export enum NetworkActivityEntryType {
  REQUEST = "request",
  RESPONSE = "response",
  REQUEST_FAILED = "requestfailed"
}

export interface NetworkActivityEntry {
  timestamp: string;
  type: NetworkActivityEntryType;
  method?: string;
  url: string;
  status?: number;
  statusText?: string;
  failureReason?: string;
}

export function isOsMapsRouteUrl(url: string): boolean {
  return !!url && url.includes("explore.osmaps.com/route/");
}

export function osMapsRouteIdFromUrl(url: string): string | null {
  if (!isOsMapsRouteUrl(url)) {
    return null;
  } else {
    const match = url.match(/explore\.osmaps\.com\/route\/([^/?#]+)/);
    return match?.[1] || null;
  }
}

export function osMapsRouteVisible(route: OsMapsListedRoute, search: string, filter: OsMapsRouteListFilter): boolean {
  const needle = (search || "").trim().toLowerCase();
  const haystack = `${route.title || ""} ${route.url || ""}`.toLowerCase();
  const matchesSearch = needle.length === 0 || haystack.includes(needle);
  const imported = !!route.importedAt;
  if (!matchesSearch) {
    return false;
  } else if (filter === OsMapsRouteListFilter.IMPORTED) {
    return imported;
  } else if (filter === OsMapsRouteListFilter.NOT_IMPORTED) {
    return !imported;
  } else {
    return true;
  }
}

export const OS_MAPS_EXPLORE_URL = "https://explore.osmaps.com/";
export const OS_MAPS_EXPORT_POLL_INTERVAL_MS = 5000;
export const OS_MAPS_EXPORT_MAX_WAIT_MS = 12 * 60 * 1000;
export const UK_CENTRE_GEOLOCATION = {latitude: 54.0, longitude: -2.5};

export function requestedOsMapsRouteFixture(url: string): OsMapsRouteFixture {
  const routeId = Number(osMapsRouteIdFromUrl(url)) || 0;
  return {
    id: routeId,
    name: routeId ? "OS Maps route" : `OS Maps route at ${url}`,
    url,
    expectedDistanceKm: 0,
    minimumTrackPoints: 1,
    minimumWaypoints: 0,
    distanceToleranceKm: Number.MAX_SAFE_INTEGER
  };
}
