import { mapAngleDelta } from "./map-gestures";

describe("mapAngleDelta", () => {
  it("returns the shortest signed turn between two headings", () => {
    expect(mapAngleDelta(10, 40)).toBe(30);
    expect(mapAngleDelta(40, 10)).toBe(-30);
    expect(mapAngleDelta(350, 10)).toBe(20);
    expect(mapAngleDelta(10, 350)).toBe(-20);
  });
});
