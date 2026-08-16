import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { isNumber } from "es-toolkit/compat";
import { NgxLoggerLevel } from "ngx-logger";
import { FileNameData } from "../../models/aws-object.model";
import { MapRoute, PageContent } from "../../models/content-text.model";
import { UIDateFormat } from "../../models/date-format.model";
import { ExtendedGroupEvent } from "../../models/group-event.model";
import {
  RouteFollowPayload,
  RouteFollowPoint,
  RouteFollowSource
} from "../../models/route-follow.model";
import { generateUid } from "../../functions/numbers";
import { DateUtilsService } from "../date-utils.service";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { PageContentService } from "../page-content.service";
import { WalksAndEventsService } from "../walks-and-events/walks-and-events.service";
import { WalkGpxService } from "../walks/walk-gpx.service";
import { RouteFollowPayloadService } from "./route-follow-payload.service";

@Injectable({
  providedIn: "root"
})
export class RouteFollowSaveService {
  private dateUtils = inject(DateUtilsService);
  private walkGpx = inject(WalkGpxService);
  private walksAndEvents = inject(WalksAndEventsService);
  private pageContent = inject(PageContentService);
  private payloadService = inject(RouteFollowPayloadService);
  private logger = inject(LoggerFactory).createLogger("RouteFollowSaveService", NgxLoggerLevel.ERROR);

  canPersist(payload: RouteFollowPayload | null): boolean {
    if (!payload) {
      return false;
    } else if (payload.source === RouteFollowSource.WALK) {
      return !!payload.walkId;
    } else if (payload.source === RouteFollowSource.PAGE) {
      return !!payload.path;
    } else {
      return false;
    }
  }

  pointsToGpx(points: RouteFollowPoint[], name: string): string {
    const stamp = this.dateUtils.isoDateTimeNow();
    const trackPoints = points.map(point => {
      const elevation = isNumber(point.elevation) ? point.elevation : 0;
      return `      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        <ele>${elevation}</ele>
      </trkpt>`;
    }).join("\n");
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ngx-ramblers" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${this.escapeXml(name)}</name>
    <time>${stamp}</time>
  </metadata>
  <trk>
    <name>${this.escapeXml(name)}</name>
    <type>hiking</type>
    <trkseg>
${trackPoints}
    </trkseg>
  </trk>
</gpx>`;
  }

  async save(payload: RouteFollowPayload, points: RouteFollowPoint[]): Promise<FileNameData> {
    if (points.length < 2) {
      throw new Error("A route needs at least two points before it can be saved.");
    } else {
      const file = this.gpxFile(payload, points);
      const uploaded = await firstValueFrom(this.walkGpx.uploadGpxFile(file));
      const gpxFile = uploaded.gpxFile;
      if (payload.source === RouteFollowSource.WALK && payload.walkId) {
        await this.attachToWalk(payload.walkId, gpxFile, payload);
      } else if (payload.source === RouteFollowSource.PAGE && payload.path) {
        await this.attachToPage(payload.path, payload.routeId, payload.title, gpxFile, payload);
      } else {
        throw new Error("This route cannot be saved back to the site.");
      }
      return gpxFile;
    }
  }

  async saveStyle(payload: RouteFollowPayload): Promise<void> {
    if (payload.source === RouteFollowSource.WALK && payload.walkId) {
      const walk: ExtendedGroupEvent = await this.walksAndEvents.queryById(payload.walkId);
      this.applyStyleToWalk(walk, payload);
      await this.walksAndEvents.createOrUpdate(walk);
    } else if (payload.source === RouteFollowSource.PAGE && payload.path) {
      await this.attachToPage(payload.path, payload.routeId, payload.title, null, payload);
    } else {
      throw new Error("This route style cannot be saved back to the site.");
    }
  }

  private async attachToWalk(walkId: string, gpxFile: FileNameData, payload: RouteFollowPayload): Promise<void> {
    const walk: ExtendedGroupEvent = await this.walksAndEvents.queryById(walkId);
    walk.fields.gpxFile = gpxFile;
    this.applyStyleToWalk(walk, payload);
    await this.walksAndEvents.createOrUpdate(walk);
  }

  private applyStyleToWalk(walk: ExtendedGroupEvent, payload: RouteFollowPayload): void {
    walk.fields.routeColor = payload.color;
    walk.fields.routeWeight = payload.weight;
    walk.fields.routeOpacity = payload.opacity;
  }

  private async attachToPage(path: string, routeId: string | null, title: string, gpxFile: FileNameData | null, payload: RouteFollowPayload): Promise<void> {
    const page: PageContent = await this.pageContent.findByPath(path);
    const row = this.payloadService.followableRow(page, routeId) || this.payloadService.firstMapRow(page);
    if (!row?.map) {
      throw new Error("This page does not have a map that can hold a route.");
    } else {
      row.map.routes = this.updatedRoutes(row.map.routes || [], routeId, title, gpxFile, payload);
      await this.pageContent.createOrUpdate(page);
    }
  }

  private updatedRoutes(routes: MapRoute[], routeId: string | null, title: string, gpxFile: FileNameData | null, payload: RouteFollowPayload): MapRoute[] {
    const matched = routeId ? routes.find(route => route.id === routeId) : routes[0];
    if (matched) {
      return routes.map(route => {
        if (route.id === matched.id) {
          const next = {
            ...route,
            color: payload.color,
            weight: payload.weight,
            opacity: payload.opacity,
            visible: route.visible !== false
          };
          return gpxFile ? {...next, gpxFile} : next;
        } else {
          return route;
        }
      });
    } else {
      return [...routes, {
        id: generateUid(),
        name: title || "Recorded route",
        visible: true,
        color: payload.color,
        weight: payload.weight,
        opacity: payload.opacity,
        ...(gpxFile ? {gpxFile} : {})
      }];
    }
  }

  private gpxFile(payload: RouteFollowPayload, points: RouteFollowPoint[]): File {
    const stamp = this.dateUtils.asString(this.dateUtils.dateTimeNow(), undefined, UIDateFormat.FILE_TIMESTAMP_COMPACT);
    const slug = payload.walkId || payload.path?.split("/").filter(item => item).pop() || "route";
    const safe = slug.replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
    const name = `${safe || "route"}-${stamp}.gpx`;
    return new File([this.pointsToGpx(points, payload.title || "Recorded route")], name, {type: "application/gpx+xml"});
  }

  private escapeXml(value: string): string {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
}
