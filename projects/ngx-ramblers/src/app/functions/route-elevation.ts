import { isNumber } from "es-toolkit/compat";
import { RouteFollowPoint } from "../models/route-follow.model";
import { cumulativeDistances } from "./route-geometry";

export interface RouteElevationSample {
  distanceMetres: number;
  elevation: number;
}

export interface RouteElevationStats {
  samples: RouteElevationSample[];
  minMetres: number;
  maxMetres: number;
  ascentMetres: number;
  descentMetres: number;
}

const SAMPLE_COUNT = 80;

export function routeHasElevation(points: RouteFollowPoint[]): boolean {
  return (points || []).some(point => isNumber(point.elevation) && point.elevation !== 0);
}

export function routeElevationStats(points: RouteFollowPoint[]): RouteElevationStats | null {
  const cumulative = cumulativeDistances(points);
  const located = points
    .map((point, index) => ({distanceMetres: cumulative[index], elevation: point.elevation}))
    .filter((sample): sample is RouteElevationSample => isNumber(sample.elevation));
  if (located.length < 2 || !routeHasElevation(points)) {
    return null;
  } else {
    const gains = located.slice(1).reduce((acc, sample, index) => {
      const change = sample.elevation - located[index].elevation;
      return {
        ascentMetres: acc.ascentMetres + (change > 0 ? change : 0),
        descentMetres: acc.descentMetres + (change < 0 ? -change : 0)
      };
    }, {ascentMetres: 0, descentMetres: 0});
    const elevations = located.map(sample => sample.elevation);
    return {
      samples: sampled(located),
      minMetres: Math.min(...elevations),
      maxMetres: Math.max(...elevations),
      ascentMetres: gains.ascentMetres,
      descentMetres: gains.descentMetres
    };
  }
}

function sampled(located: RouteElevationSample[]): RouteElevationSample[] {
  if (located.length <= SAMPLE_COUNT) {
    return located;
  } else {
    const step = (located.length - 1) / (SAMPLE_COUNT - 1);
    return Array.from({length: SAMPLE_COUNT}, (_, index) => located[Math.round(index * step)]);
  }
}

export function elevationSvgPath(stats: RouteElevationStats, width: number, height: number): string {
  const span = Math.max(stats.maxMetres - stats.minMetres, 1);
  const total = Math.max(stats.samples[stats.samples.length - 1].distanceMetres, 1);
  return stats.samples.map((sample, index) => {
    const x = (sample.distanceMetres / total) * width;
    const y = height - ((sample.elevation - stats.minMetres) / span) * height;
    return `${index === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}
