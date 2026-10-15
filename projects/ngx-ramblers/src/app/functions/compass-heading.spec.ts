import { compassHeading, smoothedCompassHeading } from "./compass-heading";

describe("compassHeading", () => {
  it("keeps north while the phone is raised from flat to upright", () => {
    [0, 30, 60, 90, 120].forEach(beta => expect(compassHeading(0, beta, 0, 0)).toBeCloseTo(0, 6));
  });

  it("handles equivalent upright orientations without a quarter-turn error", () => {
    expect(compassHeading(0, 90, 0, 0)).toBeCloseTo(0, 6);
    expect(compassHeading(90, 90, -90, 0)).toBeCloseTo(0, 6);
    expect(compassHeading(270, 90, 90, 0)).toBeCloseTo(0, 6);
    expect(compassHeading(0, 90, -90, 0)).toBeCloseTo(90, 6);
  });

  it("uses the top of the displayed screen in both landscape orientations", () => {
    expect(compassHeading(270, 0, 0, 90)).toBeCloseTo(0, 6);
    expect(compassHeading(90, 0, 0, 270)).toBeCloseTo(0, 6);
    expect(compassHeading(180, 0, 0, 180)).toBeCloseTo(0, 6);
  });

  it("preserves the previous reading when the direction cannot be determined", () => {
    expect(compassHeading(Number.NaN, 0, 0, 0)).toBeNull();
    expect(compassHeading(0, 0, 90, 0)).toBeNull();
  });

  it("eases toward the next heading and takes the short turn across north", () => {
    expect(smoothedCompassHeading(null, 90, 0.18)).toBeCloseTo(90, 6);
    expect(smoothedCompassHeading(0, 10, 0.2)).toBeCloseTo(2, 6);
    expect(smoothedCompassHeading(350, 10, 0.25)).toBeCloseTo(355, 6);
  });
});
