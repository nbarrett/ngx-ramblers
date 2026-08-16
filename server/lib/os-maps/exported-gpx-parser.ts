import { DOMParser } from "@xmldom/xmldom";
import { ExportedGpxSummary } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";

interface GpxPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_METRES = 6371e3;

function elementsNamed(parent: Document | Element, tagName: string): Element[] {
  const nodes = parent.getElementsByTagName(tagName);
  return Array.from({length: nodes.length}, (_, index) => nodes.item(index) as Element);
}

function textOf(parent: Element, tagName: string): string {
  const matches = elementsNamed(parent, tagName);
  if (matches.length === 0) {
    return "";
  } else {
    return (matches[0].textContent || "").trim();
  }
}

function pointFrom(element: Element): GpxPoint | null {
  const latitude = parseFloat(element.getAttribute("lat") || "");
  const longitude = parseFloat(element.getAttribute("lon") || "");
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  } else {
    return {latitude, longitude};
  }
}

function distanceMetres(from: GpxPoint, to: GpxPoint): number {
  const fromLat = from.latitude * Math.PI / 180;
  const toLat = to.latitude * Math.PI / 180;
  const deltaLat = (to.latitude - from.latitude) * Math.PI / 180;
  const deltaLon = (to.longitude - from.longitude) * Math.PI / 180;
  const haversine = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function trackPointsFrom(doc: Document): GpxPoint[] {
  const trackPoints = elementsNamed(doc, "trkpt")
    .map(pointFrom)
    .filter((point): point is GpxPoint => !!point);
  if (trackPoints.length > 0) {
    return trackPoints;
  } else {
    return elementsNamed(doc, "rtept")
      .map(pointFrom)
      .filter((point): point is GpxPoint => !!point);
  }
}

function totalDistanceMetres(points: GpxPoint[]): number {
  if (points.length < 2) {
    return 0;
  } else {
    return points.reduce((total, point, index) => {
      if (index === 0) {
        return total;
      } else {
        return total + distanceMetres(points[index - 1], point);
      }
    }, 0);
  }
}

function parseNonEmptyGpx(content: string, fileName: string): ExportedGpxSummary {
  const doc = new DOMParser().parseFromString(content, "text/xml");
  const parseErrors = elementsNamed(doc, "parsererror");
  const root = doc.documentElement;
  if (parseErrors.length > 0 || !root || root.localName !== "gpx") {
    throw new Error("Invalid GPX file format");
  } else {
    const metadata = elementsNamed(doc, "metadata")[0];
    const trackPoints = trackPointsFrom(doc);
    const waypoints = elementsNamed(doc, "wpt")
      .map(pointFrom)
      .filter((point): point is GpxPoint => !!point);
    const metres = totalDistanceMetres(trackPoints);
    const firstPoint = trackPoints[0];
    return {
      fileName,
      content,
      name: metadata ? textOf(metadata, "name") : textOf(root, "name"),
      creator: root.getAttribute("creator") || "",
      trackPointCount: trackPoints.length,
      waypointCount: waypoints.length,
      totalDistanceMetres: metres,
      totalDistanceKm: metres / 1000,
      startLat: firstPoint ? firstPoint.latitude : 0,
      startLng: firstPoint ? firstPoint.longitude : 0
    };
  }
}

export function parseExportedGpx(content: string, fileName = ""): ExportedGpxSummary {
  const trimmed = (content || "").trim();
  if (!trimmed) {
    throw new Error("GPX content is empty");
  } else {
    return parseNonEmptyGpx(trimmed, fileName);
  }
}

export function gpxMatchesRoute(summary: ExportedGpxSummary, expectedDistanceKm: number, distanceToleranceKm: number, minimumTrackPoints: number, minimumWaypoints: number): boolean {
  const distanceDelta = Math.abs(summary.totalDistanceKm - expectedDistanceKm);
  return summary.trackPointCount >= minimumTrackPoints
    && summary.waypointCount >= minimumWaypoints
    && distanceDelta <= distanceToleranceKm;
}
