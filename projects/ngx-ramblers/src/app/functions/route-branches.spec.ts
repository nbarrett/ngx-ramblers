import { branchMarkers, composeRoute, routeBranches, viaFromQuery } from "./route-branches";
import { cumulativeDistances } from "./route-geometry";
import { RouteFollowPoint } from "../models/route-follow.model";

const STEP = 0.0005;

function line(from: RouteFollowPoint, to: RouteFollowPoint, count: number): RouteFollowPoint[] {
  return Array.from({length: count}, (_, index) => ({
    latitude: from.latitude + (to.latitude - from.latitude) * index / (count - 1),
    longitude: from.longitude + (to.longitude - from.longitude) * index / (count - 1)
  }));
}

const corners = [{latitude: 51, longitude: 1}, {latitude: 51 + 40 * STEP, longitude: 1}, {latitude: 51 + 40 * STEP, longitude: 1 + 40 * STEP}, {latitude: 51, longitude: 1 + 40 * STEP}, {latitude: 51, longitude: 1}];
const main = corners.slice(1).flatMap((corner, index) => line(corners[index], corner, 41).slice(index === 0 ? 0 : 1));
const shortCut = line(main[20], main[60], 15);
const tracks = [{points: main}, {points: shortCut}];

describe("routeBranches", () => {
  it("finds a short cut that leaves and rejoins the main route, oriented the same way", () => {
    const branches = routeBranches(tracks);
    expect(branches.length).toBe(1);
    const branch = branches[0];
    expect(branch.index).toBe(1);
    expect(branch.forkMetres).toBeLessThan(branch.rejoinMetres);
    expect(branch.branchMetres).toBeLessThan(branch.mainMetres);
    expect(branch.points[0]).toEqual(main[20]);
  });

  it("turns a short cut drawn the other way round to run with the main route", () => {
    const branch = routeBranches([{points: main}, {points: [...shortCut].reverse()}])[0];
    expect(branch.points[0]).toEqual(main[20]);
  });

  it("ignores a track that is no shorter than the stretch of main route it replaces", () => {
    const longWay = [...line(main[20], {latitude: main[20].latitude, longitude: main[20].longitude - 30 * STEP}, 10), ...line({latitude: main[20].latitude, longitude: main[20].longitude - 30 * STEP}, main[60], 10).slice(1)];
    expect(routeBranches([{points: main}, {points: longWay}])).toEqual([]);
  });

  it("calls a branch that barely saves anything an alternative rather than a short cut", () => {
    const elbow = {latitude: main[20].latitude + 2 * STEP, longitude: main[20].longitude + 19 * STEP};
    const nearlyAsLong = [...line(main[20], elbow, 10), ...line(elbow, main[60], 10).slice(1)];
    const branch = routeBranches([{points: main}, {points: nearlyAsLong}])[0];
    expect(branch.label).toBe("Alternative 1");
    expect(routeBranches(tracks)[0].label).toBe("Short cut 1");
  });

  it("ignores a track that does not rejoin the main route", () => {
    const spur = line(main[20], {latitude: 51 + 80 * STEP, longitude: 1 + 80 * STEP}, 10);
    expect(routeBranches([{points: main}, {points: spur}])).toEqual([]);
  });
});

describe("composeRoute", () => {
  it("swaps the main route between fork and rejoin for the short cut when it is taken", () => {
    const branches = routeBranches(tracks);
    expect(composeRoute(main, branches, []).points).toBe(main);
    const composed = composeRoute(main, branches, [1]);
    const mainLength = cumulativeDistances(main).slice(-1)[0];
    const composedLength = cumulativeDistances(composed.points).slice(-1)[0];
    expect(composed.taken).toEqual([1]);
    expect(composedLength).toBeLessThan(mainLength);
    expect(composedLength).toBeGreaterThan(mainLength - branches[0].mainMetres);
    expect(composed.points[0]).toEqual(main[0]);
    expect(composed.points[composed.points.length - 1]).toEqual(main[main.length - 1]);
  });
});

describe("branchMarkers", () => {
  it("makes lettered turn steps along the short cut without a start or finish", () => {
    const elbow = {latitude: main[20].latitude, longitude: main[20].longitude + 15 * STEP};
    const bent = [...line(main[20], elbow, 8), ...line(elbow, main[60], 8).slice(1)];
    const branch = routeBranches([{points: main}, {points: bent}])[0];
    const markers = branchMarkers(branch);
    expect(markers.length).toBeGreaterThan(0);
    expect(markers.every(marker => marker.label.startsWith("1"))).toBe(true);
    expect(markers.every(marker => !/Start|Finish/.test(marker.instruction))).toBe(true);
  });
});

describe("viaFromQuery", () => {
  it("reads a comma-separated list of branch numbers", () => {
    expect(viaFromQuery("1,3")).toEqual([1, 3]);
    expect(viaFromQuery("")).toEqual([]);
    expect(viaFromQuery("0,x")).toEqual([]);
  });
});
