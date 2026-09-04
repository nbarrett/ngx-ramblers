import { cumulativeDistances, metresBetween, pointAlongRoute, projectOnSegment, snapToRoute } from "./route-geometry";

const line = [0, 0.01, 0.02].map(offset => ({latitude: 51 + offset, longitude: 1}));

describe("route geometry", () => {
  it("finds the place a given distance along the line", () => {
    const cumulative = cumulativeDistances(line);
    const halfway = pointAlongRoute(line, cumulative, cumulative[1] / 2);
    expect(halfway.point.latitude).toBeCloseTo(51.005, 6);
    expect(halfway.index).toBe(1);
    expect(pointAlongRoute(line, cumulative, -5)).toEqual({point: line[0], index: 0});
    expect(pointAlongRoute(line, cumulative, cumulative[2] + 100)).toEqual({point: line[2], index: 2});
  });

  it("measures distances and accumulates them along a line", () => {
    expect(Math.round(metresBetween(line[0], line[1]))).toBe(1112);
    expect(cumulativeDistances(line).map(Math.round)).toEqual([0, 1112, 2224]);
  });

  it("projects a point onto a segment and clamps to its ends", () => {
    const beside = projectOnSegment({latitude: 51.005, longitude: 1.001}, line[0], line[1]);
    expect(beside.point.latitude).toBeCloseTo(51.005, 5);
    expect(beside.point.longitude).toBeCloseTo(1, 5);
    expect(Math.round(beside.alongMetres)).toBe(556);
    const beyond = projectOnSegment({latitude: 51.02, longitude: 1}, line[0], line[1]);
    expect(beyond.point).toEqual(line[1]);
  });

  it("snaps a dragged position to the nearest place on the whole route", () => {
    const snap = snapToRoute(line, cumulativeDistances(line), {latitude: 51.0151, longitude: 1.002});
    expect(snap?.index).toBe(1);
    expect(snap?.point.longitude).toBeCloseTo(1, 5);
    expect(Math.round(snap?.progressMetres || 0)).toBe(Math.round(1112 * 1.51));
    expect(snapToRoute([line[0]], [0], line[1])).toBeNull();
  });
});
