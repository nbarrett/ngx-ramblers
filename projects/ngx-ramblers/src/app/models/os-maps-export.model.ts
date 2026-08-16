import { isString } from "es-toolkit/compat";
import { FileNameData } from "./aws-object.model";

export enum OsMapsExportFormat {
  GPX = "gpx"
}

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

export interface OsMapsExportJobResult {
  jobId: string;
  status: OsMapsExportJobStatus;
  walkId?: string | null;
  routeUrls?: string[];
  gpxFiles: FileNameData[];
  error?: string | null;
  createdAt: number;
  completedAt?: number | null;
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

export const ELHAM_VALLEY_NORTH_ROUTE: OsMapsRouteFixture = {
  id: 29532353,
  name: "Elham Valley North",
  url: "https://explore.osmaps.com/route/29532353/-nick--elham-valley-north-over-the-downs-57m-3hrs-easy-start-point-kingston",
  expectedDistanceKm: 10.56,
  minimumTrackPoints: 10,
  minimumWaypoints: 3,
  distanceToleranceKm: 2
};

export const OS_MAPS_EXPORT_ROUTES: OsMapsRouteFixture[] = [
  ELHAM_VALLEY_NORTH_ROUTE
];
