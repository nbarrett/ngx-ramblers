import { describe, expect, it } from "vitest";
import { isUsefulCropperPosition } from "./image-cropper-styles";

describe("isUsefulCropperPosition", () => {
  it("rejects null / undefined / zero-area crops", () => {
    expect(isUsefulCropperPosition(null)).toBe(false);
    expect(isUsefulCropperPosition(undefined)).toBe(false);
    expect(isUsefulCropperPosition({x1: 0, y1: 0, x2: 0, y2: 0} as any)).toBe(false);
    expect(isUsefulCropperPosition({x1: 50, y1: 50, x2: 50, y2: 50} as any)).toBe(false);
  });

  it("accepts whole-image crops", () => {
    expect(isUsefulCropperPosition({x1: 0, y1: 0, x2: 100, y2: 100} as any)).toBe(true);
  });

  it("accepts crops zoomed less than 3x", () => {
    expect(isUsefulCropperPosition({x1: 0, y1: 0, x2: 50, y2: 50} as any)).toBe(true);
    expect(isUsefulCropperPosition({x1: 25, y1: 25, x2: 75, y2: 75} as any)).toBe(true);
    expect(isUsefulCropperPosition({x1: 0, y1: 0, x2: 40, y2: 40} as any)).toBe(true);
  });

  it("rejects crops that would zoom 3x or more", () => {
    expect(isUsefulCropperPosition({x1: 0, y1: 0, x2: 33, y2: 33} as any)).toBe(false);
    expect(isUsefulCropperPosition({x1: 0, y1: 0, x2: 25, y2: 25} as any)).toBe(false);
    // The exact PV regression that triggered this guard:
    expect(isUsefulCropperPosition({x1: 0, y1: 0, x2: 28.156169848959816, y2: 28.174123337363966} as any)).toBe(false);
  });

  it("rejects narrow crops in either dimension", () => {
    expect(isUsefulCropperPosition({x1: 0, y1: 0, x2: 25, y2: 100} as any)).toBe(false);
    expect(isUsefulCropperPosition({x1: 0, y1: 0, x2: 100, y2: 25} as any)).toBe(false);
  });
});
