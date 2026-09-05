import { MapMarker } from "../models/content-text.model";
import { ROUTE_BRANCH_JOIN_METRES, ROUTE_SHORT_CUT_MIN_SAVING, RouteBranch, RouteComposition, RouteFollowPoint, RouteTurnStepKind, RouteWaypointKind } from "../models/route-follow.model";
import { cumulativeDistances, pointAlongRoute, snapToRoute } from "./route-geometry";
import { routeTurnSteps } from "./route-turns";

const METRES_PER_MILE = 1609.344;

export function routeBranches(tracks: {points: RouteFollowPoint[]}[], joinMetres = ROUTE_BRANCH_JOIN_METRES): RouteBranch[] {
  const main = tracks[0]?.points || [];
  if (main.length < 2) {
    return [];
  } else {
    const cumulative = cumulativeDistances(main);
    return tracks.slice(1).flatMap((track, offset) => {
      const points = track.points || [];
      const start = points.length > 1 ? snapToRoute(main, cumulative, points[0]) : null;
      const end = points.length > 1 ? snapToRoute(main, cumulative, points[points.length - 1]) : null;
      const joined = start && end && start.distanceMetres <= joinMetres && end.distanceMetres <= joinMetres && Math.abs(end.progressMetres - start.progressMetres) > joinMetres;
      const forkMetres = joined ? Math.min(start.progressMetres, end.progressMetres) : 0;
      const rejoinMetres = joined ? Math.max(start.progressMetres, end.progressMetres) : 0;
      const branchMetres = cumulativeDistances(points).slice(-1)[0] || 0;
      const mainMetres = rejoinMetres - forkMetres;
      if (!joined || branchMetres >= mainMetres) {
        return [];
      } else {
        const forwards = end.progressMetres > start.progressMetres;
        const shortCut = branchMetres <= mainMetres * (1 - ROUTE_SHORT_CUT_MIN_SAVING);
        return [{
          index: offset + 1,
          label: `${shortCut ? "Short cut" : "Alternative"} ${offset + 1}`,
          points: forwards ? points : [...points].reverse(),
          forkMetres,
          rejoinMetres,
          branchMetres,
          mainMetres,
          forkPoint: pointAlongRoute(main, cumulative, forkMetres).point
        }];
      }
    }).sort((left, right) => left.forkMetres - right.forkMetres);
  }
}

export function composeRoute(main: RouteFollowPoint[], branches: RouteBranch[], via: number[]): RouteComposition {
  const taken = branches.filter(branch => via.includes(branch.index)).sort((left, right) => left.forkMetres - right.forkMetres);
  if (main.length < 2 || taken.length === 0) {
    return {points: main, taken: []};
  } else {
    const cumulative = cumulativeDistances(main);
    const result = taken.reduce((state: {points: RouteFollowPoint[]; from: number}, branch) => {
      if (branch.forkMetres < state.from) {
        return state;
      } else {
        const mainStretch = main.filter((_, index) => cumulative[index] >= state.from && cumulative[index] <= branch.forkMetres);
        return {points: [...state.points, ...mainStretch, ...branch.points], from: branch.rejoinMetres};
      }
    }, {points: [], from: 0});
    const tail = main.filter((_, index) => cumulative[index] >= result.from);
    return {points: [...result.points, ...tail], taken: taken.map(branch => branch.index)};
  }
}

export function branchMarkers(branch: RouteBranch): MapMarker[] {
  const names = branch.points.map(() => null);
  return routeTurnSteps(branch.points, names)
    .filter(step => step.kind !== RouteTurnStepKind.START && step.kind !== RouteTurnStepKind.FINISH)
    .map((step, index) => ({
      id: `branch-${branch.index}-${index}`,
      latitude: step.latitude,
      longitude: step.longitude,
      label: `${branch.index}${String.fromCharCode(97 + index)}`,
      instruction: step.instruction,
      kind: RouteWaypointKind.TURN,
      ...(step.modifier ? {turn: step.modifier} : {})
    }));
}

export function branchChoiceLabel(branch: RouteBranch): {shortCut: string; mainRoute: string} {
  const miles = (metres: number) => `${(metres / METRES_PER_MILE).toFixed(1)} miles`;
  return {shortCut: `${branch.label} (${miles(branch.branchMetres)})`, mainRoute: `Main route (${miles(branch.mainMetres)})`};
}

export function viaFromQuery(value: string | null | undefined): number[] {
  return (value || "").split(",").map(item => Number(item.trim())).filter(item => Number.isInteger(item) && item > 0);
}
