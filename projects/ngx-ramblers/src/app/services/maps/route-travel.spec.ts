import { ROUTE_TRAVEL_MAX_MS, ROUTE_TRAVEL_MIN_MS } from "../../models/route-follow.model";
import { easeInOut, ringLift, routeTravelDuration } from "./route-travel";

describe("route travel", () => {
  it("scales the journey time with distance between sensible limits", () => {
    expect(routeTravelDuration(0)).toBe(ROUTE_TRAVEL_MIN_MS);
    expect(routeTravelDuration(800)).toBe(1200);
    expect(routeTravelDuration(50000)).toBe(ROUTE_TRAVEL_MAX_MS);
  });

  it("keeps the ring on the line until the last stretch, then lifts it onto the pin head", () => {
    expect(ringLift(0)).toBe(0);
    expect(ringLift(0.75)).toBe(0);
    expect(ringLift(0.9)).toBeLessThan(0);
    expect(ringLift(1)).toBe(-22);
  });

  it("eases in and out and reaches both ends exactly", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.25)).toBeLessThan(0.25);
  });
});

describe("routeTravelDuration with a speed factor", () => {
  it("halves the journey time at double speed and doubles it at half speed", () => {
    expect(routeTravelDuration(800, 2)).toBe(600);
    expect(routeTravelDuration(800, 0.5)).toBe(2400);
    expect(routeTravelDuration(800, 0)).toBe(1200);
  });
});
