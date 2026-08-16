import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { isNumber, isString } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { FileNameData, ServerFileNameData } from "../../models/aws-object.model";
import { MapData, MapMarker, MapRoute, PageContent, PageContentRow, PageContentType, PaletteColor } from "../../models/content-text.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import { DEFAULT_OS_STYLE, MapProvider } from "../../models/map.model";
import {
  RamblersLibraryRoute,
  RouteFollowPayload,
  RouteFollowPoint,
  RouteFollowSource,
  RouteFollowSummary,
  RouteFollowWaypoint,
  RouteWaypointKind
} from "../../models/route-follow.model";
import { generateUid } from "../../functions/numbers";
import { eventSlug } from "../../functions/walks/event-slug";
import { GpxParserService } from "./gpx-parser.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { UrlService } from "../url.service";

@Injectable({
  providedIn: "root"
})
export class RouteFollowPayloadService {
  private http = inject(HttpClient);
  private gpxParser = inject(GpxParserService);
  private urlService = inject(UrlService);
  private logger: Logger = inject(LoggerFactory).createLogger("RouteFollowPayloadService", NgxLoggerLevel.ERROR);

  followableRow(page: PageContent | null, routeId?: string | null): PageContentRow | null {
    const rows = this.mapRows(page);
    if (routeId) {
      const matched = rows.find(row => (row.map?.routes || []).some(route => route.id === routeId && this.routeHasGpx(route)));
      return matched || this.firstFollowableRow(rows);
    } else {
      return this.firstFollowableRow(rows);
    }
  }

  firstFollowableRow(rows: PageContentRow[]): PageContentRow | null {
    return rows.find(row => this.rowHasGpx(row)) || null;
  }

  firstMapRow(page: PageContent | null): PageContentRow | null {
    return this.mapRows(page).find(row => !!row.map) || null;
  }

  mapRows(page: PageContent | null): PageContentRow[] {
    return this.flattenRows(page?.rows || []);
  }

  walkHasStart(walk: ExtendedGroupEvent | null): boolean {
    const start = walk?.groupEvent?.start_location;
    return isNumber(start?.latitude) && isNumber(start?.longitude);
  }

  rowHasGpx(row: PageContentRow | null): boolean {
    return !!(row?.map && (row.map.routes || []).some(route => this.routeHasGpx(route)));
  }

  routeHasGpx(route: MapRoute | null): boolean {
    return !!(route && route.visible !== false && route.gpxFile?.awsFileName);
  }

  walkHasGpx(walk: ExtendedGroupEvent | null): boolean {
    return !!walk?.fields?.gpxFile?.awsFileName;
  }

  summariesFromPages(pages: PageContent[]): RouteFollowSummary[] {
    return (pages || []).map(page => {
      const row = this.firstFollowableRow(this.mapRows(page));
      const route = this.preferredRoute(row?.map, null);
      const title = row?.routeGuide?.title || route?.name || this.titleFromPath(page.path);
      return row && route ? {
        source: RouteFollowSource.PAGE,
        title,
        path: page.path || null,
        walkId: null,
        routeId: route.id,
        ramblersSlug: null,
        distanceMiles: row.routeGuide?.distanceMiles ?? null,
        startDescription: row.routeGuide?.startDescription || null
      } : null;
    }).filter((item): item is RouteFollowSummary => !!item);
  }

  summaryFromWalk(walk: ExtendedGroupEvent): RouteFollowSummary | null {
    if (!this.walkHasGpx(walk)) {
      return null;
    } else {
      return {
        source: RouteFollowSource.WALK,
        title: walk.groupEvent?.title || "Walk",
        path: null,
        walkId: eventSlug(walk) || walk.id || null,
        routeId: null,
        ramblersSlug: null,
        distanceMiles: walk.groupEvent?.distance_miles || null,
        startDescription: walk.groupEvent?.start_location?.description || walk.groupEvent?.start_location?.postcode || null
      };
    }
  }

  payloadFromLibraryRoute(route: RamblersLibraryRoute): RouteFollowPayload {
    return {
      source: RouteFollowSource.RAMBLERS_LIBRARY,
      title: route.title,
      path: null,
      walkId: null,
      routeId: null,
      ramblersSlug: route.slug,
      provider: MapProvider.OS,
      osStyle: DEFAULT_OS_STYLE,
      color: PaletteColor.ROSE,
      weight: 8,
      opacity: 1,
      points: route.points || [],
      waypoints: route.waypoints || [],
      totalMetres: 0,
      guide: {
        title: route.title,
        summary: route.description,
        distanceMiles: route.distanceMiles,
        durationMinutes: route.durationMinutes,
        startDescription: route.startDescription
      }
    };
  }

  summaryFromLibraryRoute(route: RamblersLibraryRoute): RouteFollowSummary {
    return {
      source: RouteFollowSource.RAMBLERS_LIBRARY,
      title: route.title,
      path: null,
      walkId: null,
      routeId: null,
      ramblersSlug: route.slug,
      distanceMiles: route.distanceMiles,
      startDescription: route.startDescription
    };
  }

  async payloadFromPage(page: PageContent, routeId?: string | null): Promise<RouteFollowPayload | null> {
    const row = this.followableRow(page, routeId) || this.firstMapRow(page);
    const map = row?.map;
    if (!row || !map) {
      return null;
    } else {
      const route = this.preferredRoute(map, routeId);
      const parsed = route ? await this.loadGpx(route.gpxFile) : {points: [] as RouteFollowPoint[], waypoints: [] as RouteFollowWaypoint[], totalMetres: 0};
      const points = parsed.points;
      const waypoints = this.mergeWaypoints(map.markers || [], parsed.waypoints);
      return {
        source: RouteFollowSource.PAGE,
        title: row.routeGuide?.title || route?.name || this.titleFromPath(page.path),
        path: page.path || null,
        walkId: null,
        routeId: route?.id || null,
        ramblersSlug: null,
        provider: map.provider || MapProvider.OS,
        osStyle: map.osStyle || DEFAULT_OS_STYLE,
        color: route?.color || PaletteColor.ROSE,
        weight: route?.weight || 8,
        opacity: route && isNumber(route.opacity) ? route.opacity : 1,
        points,
        waypoints,
        totalMetres: parsed.totalMetres,
        guide: row.routeGuide || null
      };
    }
  }

  async payloadFromWalk(walk: ExtendedGroupEvent): Promise<RouteFollowPayload | null> {
    if (!this.walkHasGpx(walk) && !this.walkHasStart(walk)) {
      return null;
    } else {
      const parsed = this.walkHasGpx(walk)
        ? await this.loadGpx(walk.fields.gpxFile)
        : {points: [] as RouteFollowPoint[], waypoints: [] as RouteFollowWaypoint[], totalMetres: 0};
      const authored = walk.fields?.routeWaypoints || [];
      const start = walk.groupEvent?.start_location;
      const startMarkers = !this.walkHasGpx(walk) && start && isNumber(start.latitude) && isNumber(start.longitude) ? [{
        latitude: start.latitude,
        longitude: start.longitude,
        label: "Start",
        instruction: start.description || start.postcode || "Start here",
        kind: RouteWaypointKind.START
      }] : authored;
      const waypoints = this.mergeWaypoints(startMarkers, parsed.waypoints);
      return {
        source: RouteFollowSource.WALK,
        title: walk.groupEvent?.title || "Walk",
        path: null,
        walkId: eventSlug(walk) || walk.id || null,
        routeId: null,
        ramblersSlug: null,
        provider: MapProvider.OS,
        osStyle: DEFAULT_OS_STYLE,
        color: walk.fields?.routeColor || PaletteColor.ROSE,
        weight: walk.fields?.routeWeight || 8,
        opacity: isNumber(walk.fields?.routeOpacity) ? walk.fields.routeOpacity : 1,
        points: parsed.points,
        waypoints,
        totalMetres: parsed.totalMetres,
        guide: {
          title: walk.groupEvent?.title,
          summary: walk.groupEvent?.description,
          distanceMiles: walk.groupEvent?.distance_miles,
          startDescription: walk.groupEvent?.start_location?.description || walk.groupEvent?.start_location?.postcode
        }
      };
    }
  }

  gpxDownloadUrl(fileData: FileNameData | Partial<ServerFileNameData> | undefined): string | null {
    if (!fileData?.awsFileName) {
      return null;
    } else {
      const rootFolder = (fileData as Partial<ServerFileNameData>).rootFolder;
      const filePath = rootFolder && !fileData.awsFileName.startsWith(`${rootFolder}/`)
        ? `${rootFolder}/${fileData.awsFileName}`
        : fileData.awsFileName;
      if (this.urlService.isRemoteUrl(filePath)) {
        return filePath;
      } else {
        return this.urlService.resourceRelativePathForAWSFileName(filePath) || null;
      }
    }
  }

  waypointFromMarker(marker: MapMarker, index: number): RouteFollowWaypoint {
    return {
      id: marker.id || generateUid(),
      latitude: marker.latitude,
      longitude: marker.longitude,
      label: marker.label || String(index + 1),
      instruction: marker.instruction || null,
      kind: marker.kind || RouteWaypointKind.WAYPOINT
    };
  }

  private preferredRoute(map: MapData | undefined, routeId?: string | null): MapRoute | null {
    const routes = (map?.routes || []).filter(route => this.routeHasGpx(route));
    if (routeId) {
      return routes.find(route => route.id === routeId) || routes[0] || null;
    } else {
      return routes[0] || null;
    }
  }

  private async loadGpx(fileData: FileNameData | Partial<ServerFileNameData> | undefined): Promise<{points: RouteFollowPoint[]; waypoints: RouteFollowWaypoint[]; totalMetres: number}> {
    const url = this.gpxDownloadUrl(fileData);
    if (!url) {
      return {points: [], waypoints: [], totalMetres: 0};
    } else {
      try {
        const content = await firstValueFrom(this.http.get(url, {responseType: "text"}));
        const parsed = this.gpxParser.parseGpxFile(content);
        const points = (parsed.tracks || []).reduce((acc: RouteFollowPoint[], track) => {
          const trackPoints = (track.points || []).map(point => ({
            latitude: point.latitude,
            longitude: point.longitude,
            elevation: isNumber(point.elevation) ? point.elevation : null
          }));
          return [...acc, ...trackPoints];
        }, []);
        const waypoints = (parsed.waypoints || []).map((waypoint, index) => ({
          id: generateUid(),
          latitude: waypoint.latitude,
          longitude: waypoint.longitude,
          label: waypoint.name || String(index + 1),
          instruction: waypoint.description || null,
          kind: RouteWaypointKind.WAYPOINT
        }));
        const totalMetres = (parsed.tracks || []).reduce((sum, track) => sum + (track.totalDistance || 0), 0);
        return {points, waypoints, totalMetres};
      } catch (error) {
        this.logger.error("loadGpx failed for", url, error);
        return {points: [], waypoints: [], totalMetres: 0};
      }
    }
  }

  private mergeWaypoints(authored: MapMarker[], fromGpx: RouteFollowWaypoint[]): RouteFollowWaypoint[] {
    if (authored.length > 0) {
      return authored.map((marker, index) => this.waypointFromMarker(marker, index));
    } else {
      return fromGpx;
    }
  }

  private flattenRows(rows: PageContentRow[]): PageContentRow[] {
    return (rows || []).reduce((acc: PageContentRow[], row) => {
      const nested = (row.columns || []).reduce((inner: PageContentRow[], column) => {
        return [...inner, ...this.flattenRows(column.rows || [])];
      }, []);
      const include = row.type === PageContentType.MAP || row.type === PageContentType.ROUTE;
      return include ? [...acc, row, ...nested] : [...acc, ...nested];
    }, []);
  }

  private titleFromPath(path: string | undefined): string {
    if (!isString(path) || path.length === 0) {
      return "Route";
    } else {
      const segment = path.split("/").filter(item => item).pop() || "Route";
      return segment.replace(/-/g, " ").replace(/\b\w/g, character => character.toUpperCase());
    }
  }
}
