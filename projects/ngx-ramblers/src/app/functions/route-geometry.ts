import { RouteFollowPoint, RouteFollowSnap, RoutePointAlong } from "../models/route-follow.model";

const EARTH_RADIUS_METRES = 6371000;

export function metresBetween(from: RouteFollowPoint, to: RouteFollowPoint): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(from.latitude)) * Math.cos(toRadians(to.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(a));
}

export function cumulativeDistances(points: RouteFollowPoint[]): number[] {
  const running = {total: 0};
  return points.map((point, index) => {
    running.total += index === 0 ? 0 : metresBetween(points[index - 1], point);
    return running.total;
  });
}

export function firstIndexAtLeast(values: number[], target: number, low: number, high: number): number {
  if (low >= high) {
    return low;
  } else {
    const middle = Math.floor((low + high) / 2);
    return values[middle] >= target ? firstIndexAtLeast(values, target, low, middle) : firstIndexAtLeast(values, target, middle + 1, high);
  }
}

export function lastIndexAtMost(values: number[], target: number, low: number, high: number): number {
  if (low >= high) {
    return low;
  } else {
    const middle = Math.ceil((low + high) / 2);
    return values[middle] <= target ? lastIndexAtMost(values, target, middle, high) : lastIndexAtMost(values, target, low, middle - 1);
  }
}

export function pointAlongRoute(points: RouteFollowPoint[], cumulative: number[], distance: number): RoutePointAlong {
  const next = cumulative.findIndex(value => value >= distance);
  if (points.length === 0) {
    return {point: {latitude: 0, longitude: 0}, index: -1};
  } else if (next <= 0) {
    return next === 0 ? {point: points[0], index: 0} : {point: points[points.length - 1], index: points.length - 1};
  } else {
    const previous = next - 1;
    const span = cumulative[next] - cumulative[previous];
    const fraction = span > 0 ? (distance - cumulative[previous]) / span : 0;
    return {
      point: {
        latitude: points[previous].latitude + (points[next].latitude - points[previous].latitude) * fraction,
        longitude: points[previous].longitude + (points[next].longitude - points[previous].longitude) * fraction
      },
      index: fraction < 0.5 ? previous : next
    };
  }
}

export function nearestPointIndex(points: RouteFollowPoint[], target: RouteFollowPoint): number {
  return points.reduce((best, point, index) => {
    const distance = metresBetween(point, target);
    return distance < best.distance ? {index, distance} : best;
  }, {index: -1, distance: Number.POSITIVE_INFINITY}).index;
}

export function bearingBetween(from: RouteFollowPoint, to: RouteFollowPoint): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);
  const y = Math.sin(deltaLongitude) * Math.cos(toLatitude);
  const x = Math.cos(fromLatitude) * Math.sin(toLatitude) - Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(deltaLongitude);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

export function projectOnSegment(point: RouteFollowPoint, start: RouteFollowPoint, end: RouteFollowPoint): {point: RouteFollowPoint; distanceMetres: number; alongMetres: number} {
  const startToEnd = metresBetween(start, end);
  if (startToEnd === 0) {
    return {point: start, distanceMetres: metresBetween(point, start), alongMetres: 0};
  } else {
    const dx = end.longitude - start.longitude;
    const dy = end.latitude - start.latitude;
    const tUnclamped = ((point.longitude - start.longitude) * dx + (point.latitude - start.latitude) * dy) / (dx * dx + dy * dy);
    const t = tUnclamped < 0 ? 0 : (tUnclamped > 1 ? 1 : tUnclamped);
    const projected: RouteFollowPoint = {
      latitude: start.latitude + dy * t,
      longitude: start.longitude + dx * t
    };
    return {point: projected, distanceMetres: metresBetween(point, projected), alongMetres: startToEnd * t};
  }
}

export function snapToRoute(points: RouteFollowPoint[], cumulative: number[], position: RouteFollowPoint): RouteFollowSnap | null {
  if (points.length < 2) {
    return null;
  } else {
    return points.slice(1).reduce((best: RouteFollowSnap, end, offset) => {
      const projected = projectOnSegment(position, points[offset], end);
      return projected.distanceMetres < best.distanceMetres ? {
        point: projected.point,
        index: offset,
        distanceMetres: projected.distanceMetres,
        progressMetres: cumulative[offset] + projected.alongMetres
      } : best;
    }, {point: points[0], index: 0, distanceMetres: Number.POSITIVE_INFINITY, progressMetres: 0});
  }
}
