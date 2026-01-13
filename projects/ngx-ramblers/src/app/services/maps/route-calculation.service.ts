import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Observable, throwError } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { DateUtilsService } from "../date-utils.service";
import { RouteProfile } from "../../models/route-calculation.model";

export interface RoutePoint {
  latitude: number;
  longitude: number;
}

export interface RouteSegment {
  points: RoutePoint[];
  distance: number;
  duration: number;
  ascent?: number;
  descent?: number;
}

export interface CalculatedRoute {
  segments: RouteSegment[];
  totalDistance: number;
  totalDuration: number;
  totalAscent: number;
  totalDescent: number;
  geometry: RoutePoint[];
}

@Injectable({
  providedIn: "root"
})
export class RouteCalculationService {
  private http = inject(HttpClient);
  private logger: Logger = inject(LoggerFactory).createLogger("RouteCalculationService", NgxLoggerLevel.ERROR);
  private dateUtils = inject(DateUtilsService);

  private readonly ORS_API_URL = "https://api.openrouteservice.org/v2/directions";

  calculateWalkingRoute(waypoints: RoutePoint[], profile: RouteProfile = RouteProfile.FOOT_HIKING, apiKey?: string): Observable<CalculatedRoute> {
    if (waypoints.length < 2) {
      return throwError(() => new Error("At least 2 waypoints required"));
    }

    const coordinates = waypoints.map(wp => [wp.longitude, wp.latitude]);

    const body = {
      coordinates,
      preference: "recommended",
      units: "m",
      language: "en",
      geometry: true,
      instructions: false,
      elevation: true,
      extra_info: ["surface", "waytype"]
    };

    const url = `${this.ORS_API_URL}/${profile}/geojson`;

    const headers: any = {
      "Content-Type": "application/json"
    };

    if (apiKey) {
      headers["Authorization"] = apiKey;
    }

    this.logger.info("Calculating route with", waypoints.length, "waypoints using", profile);

    return this.http.post<any>(url, body, { headers }).pipe(
      map(response => this.parseOrsResponse(response)),
      catchError((error: HttpErrorResponse) => {
        this.logger.error("Route calculation failed:", error);
        if (error.status === 401) {
          return throwError(() => new Error("OpenRouteService API key required. Please configure in environment."));
        }
        if (error.status === 429) {
          return throwError(() => new Error("Rate limit exceeded. Please try again later."));
        }
        return throwError(() => new Error(`Route calculation failed: ${error.message}`));
      })
    );
  }

  private parseOrsResponse(response: any): CalculatedRoute {
    const feature = response.features[0];
    const geometry = feature.geometry;
    const properties = feature.properties;

    const points: RoutePoint[] = geometry.coordinates.map((coord: number[]) => ({
      longitude: coord[0],
      latitude: coord[1]
    }));

    const segments: RouteSegment[] = properties.segments.map((seg: any) => ({
      points: seg.steps?.map((step: any) => ({
        latitude: step.way_points[0],
        longitude: step.way_points[1]
      })) || [],
      distance: seg.distance,
      duration: seg.duration,
      ascent: seg.ascent,
      descent: seg.descent
    }));

    return {
      segments,
      totalDistance: properties.summary.distance,
      totalDuration: properties.summary.duration,
      totalAscent: properties.ascent || 0,
      totalDescent: properties.descent || 0,
      geometry: points
    };
  }

  routeToGpx(route: CalculatedRoute, name: string, description?: string): string {
    const timestamp = this.dateUtils.isoDateTimeNow();

    let gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ngx-ramblers" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${this.escapeXml(name)}</name>`;

    if (description) {
      gpx += `
    <desc>${this.escapeXml(description)}</desc>`;
    }

    gpx += `
    <author>
      <name>NGX Ramblers Route Calculator</name>
    </author>
    <time>${timestamp}</time>
  </metadata>
  <trk>
    <name>${this.escapeXml(name)}</name>`;

    if (description) {
      gpx += `
    <desc>${this.escapeXml(description)}</desc>`;
    }

    gpx += `
    <type>hiking</type>
    <trkseg>`;

    route.geometry.forEach(point => {
      gpx += `
      <trkpt lat="${point.latitude}" lon="${point.longitude}">
        <ele>0</ele>
      </trkpt>`;
    });

    gpx += `
    </trkseg>
  </trk>
</gpx>`;

    return gpx;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }
}
