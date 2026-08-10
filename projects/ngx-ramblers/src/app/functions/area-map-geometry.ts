import { range } from "es-toolkit";
import { isArray, isNumber, isString } from "es-toolkit/compat";
import {
  GeoBoundsCorners,
  GeoPoint,
  LabelPlacement,
  LabelSize,
  PixelPoint,
  PixelRect,
  RenderableGeoJsonFeature
} from "../models/area-map.model";

const LABEL_SEARCH_DIRECTIONS: PixelPoint[] = [
  {x: 0, y: 0},
  {x: 1, y: 0},
  {x: -1, y: 0},
  {x: 0, y: 1},
  {x: 0, y: -1},
  {x: 1, y: 1},
  {x: -1, y: 1},
  {x: 1, y: -1},
  {x: -1, y: -1},
  {x: 2, y: 1},
  {x: -2, y: 1},
  {x: 2, y: -1},
  {x: -2, y: -1},
  {x: 1, y: 2},
  {x: -1, y: 2},
  {x: 1, y: -2},
  {x: -1, y: -2}
];

const LABEL_STEP_DISTANCE = 14;
const LABEL_MAX_STEPS = 20;

export function estimateLabelSize(text: string): LabelSize {
  const averageCharWidth = 7;
  const minWidth = 90;
  const maxWidth = 220;
  const width = Math.max(minWidth, Math.min(maxWidth, text.length * averageCharWidth + 16));
  const height = 22;
  return {width, height};
}

export function hashedLabelOffset(text: string): GeoPoint {
  const hash = text.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return {
    lat: ((hash % 7) - 3) * 0.005,
    lng: (((hash * 13) % 7) - 3) * 0.005
  };
}

export function labelBoundsAround(point: PixelPoint, size: LabelSize): PixelRect {
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;
  return {
    min: {x: point.x - halfWidth, y: point.y - halfHeight},
    max: {x: point.x + halfWidth, y: point.y + halfHeight}
  };
}

export function pixelRectsIntersect(first: PixelRect, second: PixelRect): boolean {
  return second.max.x >= first.min.x && second.min.x <= first.max.x
    && second.max.y >= first.min.y && second.min.y <= first.max.y;
}

export function findLabelPlacement(origin: PixelPoint, size: LabelSize, existingPlacements: PixelRect[]): LabelPlacement | null {
  const collides = (bounds: PixelRect) => existingPlacements.some(existing => pixelRectsIntersect(existing, bounds));
  const placement = range(0, LABEL_MAX_STEPS)
    .map(step => LABEL_SEARCH_DIRECTIONS
      .map(direction => {
        const point = {
          x: origin.x + direction.x * LABEL_STEP_DISTANCE * step,
          y: origin.y + direction.y * LABEL_STEP_DISTANCE * step
        };
        return {point, bounds: labelBoundsAround(point, size)};
      })
      .find(candidate => !collides(candidate.bounds)))
    .find((candidate): candidate is LabelPlacement => !!candidate);
  return placement ?? null;
}

export function pointInRing(point: GeoPoint, ring: GeoPoint[]): boolean {
  return isArray(ring) && ring.reduce((inside: boolean, current: GeoPoint, index: number) => {
    const next = ring[(index + 1) % ring.length];
    const intersects = !!current && !!next
      && ((current.lat > point.lat) !== (next.lat > point.lat))
      && (point.lng < (next.lng - current.lng) * (point.lat - current.lat) / (next.lat - current.lat) + current.lng);
    return intersects ? !inside : inside;
  }, false);
}

export function pointInPolygonRings(point: GeoPoint, rings: GeoPoint[][] | GeoPoint[][][]): boolean {
  const flatRings = isArray(rings[0]) && isArray((rings[0] as GeoPoint[][])[0])
    ? (rings as GeoPoint[][][]).flat()
    : (rings as GeoPoint[][]);
  return flatRings.some(ring => pointInRing(point, ring));
}

export function zoomDrivenBoundsOffset(zoom: number): number {
  return zoom <= 8 ? 1.2 : zoom <= 10 ? 0.8 : 0.4;
}

export function boundsCornersAround(center: GeoPoint, zoom: number): GeoBoundsCorners {
  const offset = zoomDrivenBoundsOffset(zoom);
  return {
    southWest: {lat: center.lat - offset, lng: center.lng - offset},
    northEast: {lat: center.lat + offset, lng: center.lng + offset}
  };
}

export function clampZoom(zoom: number): number {
  return Math.min(18, Math.max(2, zoom));
}

export function parsedStoredZoom(storedZoom: unknown): number {
  const numericZoom = isNumber(storedZoom) && !isNaN(storedZoom) && isFinite(storedZoom)
    ? storedZoom
    : isString(storedZoom) ? parseFloat(storedZoom) : NaN;
  return !isNaN(numericZoom) && isFinite(numericZoom) ? numericZoom : 9;
}

export function zoomWithinStoredRange(zoom: number): boolean {
  return zoom >= 2 && zoom <= 18;
}

export function featureHasRenderableGeometry(feature: RenderableGeoJsonFeature): boolean {
  return feature.type === "FeatureCollection"
    ? !!(feature.features && feature.features.length > 0)
    : !!(feature.geometry && feature.geometry.coordinates && feature.geometry.coordinates.length > 0);
}
