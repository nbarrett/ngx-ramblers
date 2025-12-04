import { Injectable } from "@angular/core";
import { isUndefined } from "es-toolkit/compat";

export interface GpxTrackPoint {
  latitude: number;
  longitude: number;
  elevation?: number;
  time?: Date;
  name?: string;
}

export interface GpxTrack {
  name: string;
  description?: string;
  points: GpxTrackPoint[];
  totalDistance?: number;
  minElevation?: number;
  maxElevation?: number;
  totalAscent?: number;
  totalDescent?: number;
}

export interface GpxWaypoint {
  latitude: number;
  longitude: number;
  name?: string;
  description?: string;
  symbol?: string;
}

export interface GpxMetadata {
  name?: string;
  description?: string;
  author?: string;
  time?: Date;
}

export interface ParsedGpx {
  metadata: GpxMetadata;
  tracks: GpxTrack[];
  waypoints: GpxWaypoint[];
}

@Injectable({
  providedIn: "root"
})
export class GpxParserService {

  parseGpxFile(gpxContent: string): ParsedGpx {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, "text/xml");

    const parseError = xmlDoc.querySelector("parsererror");
    if (parseError) {
      throw new Error("Invalid GPX file format");
    }

    const metadata = this.parseMetadata(xmlDoc);
    const tracks = this.parseTracks(xmlDoc);
    const waypoints = this.parseWaypoints(xmlDoc);

    return {
      metadata,
      tracks,
      waypoints
    };
  }

  private parseMetadata(xmlDoc: Document): GpxMetadata {
    const metadataEl = xmlDoc.querySelector("metadata");
    if (!metadataEl) {
      return {};
    }

    return {
      name: this.getTextContent(metadataEl, "name"),
      description: this.getTextContent(metadataEl, "desc"),
      author: this.getTextContent(metadataEl, "author > name"),
      time: this.parseDate(this.getTextContent(metadataEl, "time"))
    };
  }

  private parseTracks(xmlDoc: Document): GpxTrack[] {
    const trackElements = xmlDoc.querySelectorAll("trk");
    const tracks: GpxTrack[] = [];

    trackElements.forEach(trackEl => {
      const track = this.parseTrack(trackEl);
      if (track.points.length > 0) {
        tracks.push(track);
      }
    });

    return tracks;
  }

  private parseTrack(trackEl: Element): GpxTrack {
    const name = this.getTextContent(trackEl, "name") || "Untitled Track";
    const description = this.getTextContent(trackEl, "desc");
    const points = this.parseTrackPoints(trackEl);

    const track: GpxTrack = {
      name,
      description,
      points
    };

    if (points.length > 0) {
      this.calculateTrackStatistics(track);
    }

    return track;
  }

  private parseTrackPoints(trackEl: Element): GpxTrackPoint[] {
    const trkptElements = trackEl.querySelectorAll("trkpt");
    const points: GpxTrackPoint[] = [];

    trkptElements.forEach(trkptEl => {
      const lat = parseFloat(trkptEl.getAttribute("lat") || "0");
      const lon = parseFloat(trkptEl.getAttribute("lon") || "0");

      if (!isNaN(lat) && !isNaN(lon)) {
        const point: GpxTrackPoint = {
          latitude: lat,
          longitude: lon
        };

        const eleText = this.getTextContent(trkptEl, "ele");
        if (eleText) {
          point.elevation = parseFloat(eleText);
        }

        const timeText = this.getTextContent(trkptEl, "time");
        if (timeText) {
          point.time = this.parseDate(timeText);
        }

        const name = this.getTextContent(trkptEl, "name");
        if (name) {
          point.name = name;
        }

        points.push(point);
      }
    });

    return points;
  }

  private parseWaypoints(xmlDoc: Document): GpxWaypoint[] {
    const waypointElements = xmlDoc.querySelectorAll("wpt, rtept");
    const waypoints: GpxWaypoint[] = [];

    waypointElements.forEach(element => {
      const lat = parseFloat(element.getAttribute("lat") || "");
      const lon = parseFloat(element.getAttribute("lon") || "");
      if (isNaN(lat) || isNaN(lon)) {
        return;
      }

      const name = this.getTextContent(element, "name");
      const description = this.getTextContent(element, "desc");
      const symbol = this.getTextContent(element, "sym");

      if (!this.isUsefulWaypoint(name, description, symbol)) {
        return;
      }

      waypoints.push({
        latitude: lat,
        longitude: lon,
        name,
        description,
        symbol
      });
    });

    return waypoints;
  }

  private isUsefulWaypoint(name?: string, description?: string, symbol?: string): boolean {
    if (!name && !description && !symbol) {
      return false;
    }

    if (name && /^.*\s+\d+$/.test(name) && !description) {
      return false;
    }

    return true;
  }

  private calculateTrackStatistics(track: GpxTrack): void {
    if (track.points.length < 2) {
      return;
    }

    let totalDistance = 0;
    let minElevation: number | undefined;
    let maxElevation: number | undefined;
    let totalAscent = 0;
    let totalDescent = 0;
    let previousElevation: number | undefined;

    for (let i = 0; i < track.points.length; i++) {
      const point = track.points[i];

      if (!isUndefined(point.elevation)) {
        if (isUndefined(minElevation) || point.elevation < minElevation) {
          minElevation = point.elevation;
        }
        if (isUndefined(maxElevation) || point.elevation > maxElevation) {
          maxElevation = point.elevation;
        }

        if (!isUndefined(previousElevation)) {
          const elevationChange = point.elevation - previousElevation;
          if (elevationChange > 0) {
            totalAscent += elevationChange;
          } else {
            totalDescent += Math.abs(elevationChange);
          }
        }
        previousElevation = point.elevation;
      }

      if (i > 0) {
        const previousPoint = track.points[i - 1];
        totalDistance += this.calculateDistance(
          previousPoint.latitude,
          previousPoint.longitude,
          point.latitude,
          point.longitude
        );
      }
    }

    track.totalDistance = totalDistance;
    track.minElevation = minElevation;
    track.maxElevation = maxElevation;
    track.totalAscent = totalAscent;
    track.totalDescent = totalDescent;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  private getTextContent(element: Element, selector: string): string | undefined {
    const el = element.querySelector(selector);
    return el?.textContent?.trim() || undefined;
  }

  private parseDate(dateString: string | undefined): Date | undefined {
    if (!dateString) {
      return undefined;
    }
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date;
  }

  toLeafletLatLngs(track: GpxTrack): [number, number][] {
    return track.points.map(point => [point.latitude, point.longitude]);
  }

  getBounds(track: GpxTrack): { minLat: number; maxLat: number; minLng: number; maxLng: number } | null {
    if (track.points.length === 0) {
      return null;
    }

    let minLat = track.points[0].latitude;
    let maxLat = track.points[0].latitude;
    let minLng = track.points[0].longitude;
    let maxLng = track.points[0].longitude;

    track.points.forEach(point => {
      if (point.latitude < minLat) minLat = point.latitude;
      if (point.latitude > maxLat) maxLat = point.latitude;
      if (point.longitude < minLng) minLng = point.longitude;
      if (point.longitude > maxLng) maxLng = point.longitude;
    });

    return { minLat, maxLat, minLng, maxLng };
  }
}
