import { RouteFollowReturnDirection } from "../../models/route-follow.model";
import { mapAngleDelta, returnDirectionFrom, screenDeltaToLocal, unwrapBearing } from "./map-gestures";

describe("mapAngleDelta", () => {
  it("returns the shortest signed turn between two headings", () => {
    expect(mapAngleDelta(10, 40)).toBe(30);
    expect(mapAngleDelta(40, 10)).toBe(-30);
    expect(mapAngleDelta(350, 10)).toBe(20);
    expect(mapAngleDelta(10, 350)).toBe(-20);
  });
});

describe("unwrapBearing", () => {
  it("keeps turning the short way round instead of unwinding through north", () => {
    expect(unwrapBearing(170, -170)).toBe(190);
    expect(unwrapBearing(190, 0)).toBe(360);
    expect(unwrapBearing(-10, 10)).toBe(10);
  });
});

describe("returnDirectionFrom", () => {
  it("says forward when the line is ahead", () => {
    expect(returnDirectionFrom(0, 10)).toEqual(RouteFollowReturnDirection.FORWARD);
  });

  it("says right when the line is to the right", () => {
    expect(returnDirectionFrom(0, 90)).toEqual(RouteFollowReturnDirection.RIGHT);
  });

  it("says left when the line is to the left", () => {
    expect(returnDirectionFrom(0, 270)).toEqual(RouteFollowReturnDirection.LEFT);
  });

  it("says back when the line is behind", () => {
    expect(returnDirectionFrom(0, 180)).toEqual(RouteFollowReturnDirection.BACK);
  });
});

describe("screenDeltaToLocal", () => {
  it("leaves an unrotated drag unchanged", () => {
    expect(screenDeltaToLocal(12, -8, 0)).toEqual({x: 12, y: -8});
  });

  it("reverses a drag when the map is upside down", () => {
    const local = screenDeltaToLocal(10, 0, 180);
    expect(local.x).toBeCloseTo(-10, 6);
    expect(local.y).toBeCloseTo(0, 6);
  });

  it("turns a rightward drag into an upward map move at 90 degrees", () => {
    const local = screenDeltaToLocal(10, 0, 90);
    expect(local.x).toBeCloseTo(0, 6);
    expect(local.y).toBeCloseTo(-10, 6);
  });
});
