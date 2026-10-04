import { RouteFollowPoint } from "../../../projects/ngx-ramblers/src/app/models/route-follow.model";
import { DOMParser } from "@xmldom/xmldom";
import { ExportedGpxSummary } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { dateTimeFromIso } from "../shared/dates";

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

function pointFrom(element: Element): RouteFollowPoint | null {
  const latitude = parseFloat(element.getAttribute("lat") || "");
  const longitude = parseFloat(element.getAttribute("lon") || "");
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
    return null;
  } else {
    return {latitude, longitude};
  }
}

function distanceMetres(from: RouteFollowPoint, to: RouteFollowPoint): number {
  const fromLat = from.latitude * Math.PI / 180;
  const toLat = to.latitude * Math.PI / 180;
  const deltaLat = (to.latitude - from.latitude) * Math.PI / 180;
  const deltaLon = (to.longitude - from.longitude) * Math.PI / 180;
  const haversine = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2)
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  return EARTH_RADIUS_METRES * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function trackPointsFrom(doc: Document): RouteFollowPoint[] {
  const seenSegments = new Set<Element>();
  const trackPoints = elementsNamed(doc, "trkpt")
    .map(element => {
      const point = pointFrom(element);
      const segment = element.parentNode as Element;
      if (point && segment?.localName === "trkseg") {
        const breakBefore = !seenSegments.has(segment);
        seenSegments.add(segment);
        return {...point, breakBefore};
      } else {
        return point;
      }
    })
    .filter((point): point is RouteFollowPoint => !!point);
  if (trackPoints.length > 0) {
    return trackPoints;
  } else {
    return elementsNamed(doc, "rtept")
      .map(pointFrom)
      .filter((point): point is RouteFollowPoint => !!point);
  }
}

function totalDistanceMetres(points: RouteFollowPoint[]): number {
  if (points.length < 2) {
    return 0;
  } else {
    return points.reduce((total, point, index) => {
      if (index === 0) {
        return total;
      } else {
        return total + (point.breakBefore ? 0 : distanceMetres(points[index - 1], point));
      }
    }, 0);
  }
}

function firstTimeMillis(doc: Document): number | null {
  const times = elementsNamed(doc, "time")
    .map(element => dateTimeFromIso((element.textContent || "").trim()))
    .filter(dateTime => dateTime.isValid);
  return times.length > 0 ? times[0].toMillis() : null;
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
      .filter((point): point is RouteFollowPoint => !!point);
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
      startLng: firstPoint ? firstPoint.longitude : 0,
      walkedAt: firstTimeMillis(doc)
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
