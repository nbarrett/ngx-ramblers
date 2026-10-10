import { elevationSvgPath, routeElevationStats } from "./route-elevation";
import { RouteFollowPoint } from "../models/route-follow.model";

const climb: RouteFollowPoint[] = [
  {latitude: 51.2, longitude: 0.7, elevation: 10},
  {latitude: 51.201, longitude: 0.7, elevation: 40},
  {latitude: 51.202, longitude: 0.7, elevation: 25}
];

describe("routeElevationStats", () => {
  it("returns null when fewer than two points have elevation", () => {
    expect(routeElevationStats([{latitude: 51, longitude: 0}, {latitude: 51.1, longitude: 0}])).toBeNull();
    expect(routeElevationStats([{latitude: 51, longitude: 0, elevation: 12}])).toBeNull();
  });

  it("returns null when every recorded height is zero", () => {
    expect(routeElevationStats([
      {latitude: 51.2, longitude: 0.7, elevation: 0},
      {latitude: 51.201, longitude: 0.7, elevation: 0}
    ])).toBeNull();
  });

  it("records min, max, ascent and descent along the line", () => {
    const stats = routeElevationStats(climb);
    expect(stats.minMetres).toBe(10);
    expect(stats.maxMetres).toBe(40);
    expect(stats.ascentMetres).toBe(30);
    expect(stats.descentMetres).toBe(15);
    expect(stats.samples.length).toBe(3);
  });
});

describe("elevationSvgPath", () => {
  it("starts at the first sample and ends at the last", () => {
    const stats = routeElevationStats(climb);
    const path = elevationSvgPath(stats, 100, 40);
    expect(path.startsWith("M")).toBe(true);
    expect(path).toContain(" L");
  });
});
