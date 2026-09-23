import { describe, expect, it } from "vitest";
import { cropperFrameAspectRatio, cropperWrapperStyles, isUsefulCropperPosition } from "./image-cropper-styles";

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

describe("cropperFrameAspectRatio", () => {
  const routePageCrop = {x1: 0, y1: 4.947368421052632, x2: 87.45644599303137, y2: 87.47368421052632} as any;

  it("uses crop percentages before the image has loaded", () => {
    expect(cropperFrameAspectRatio(routePageCrop)).toBe("87.45644599303137 / 82.52631578947368");
  });

  it("uses the cropped pixel box once natural size is known", () => {
    expect(cropperFrameAspectRatio(routePageCrop, 1600, 900)).toBe("1399.3031358885019 / 742.7368421052631");
  });

  it("falls back to the full image when the crop is not useful", () => {
    expect(cropperFrameAspectRatio({x1: 0, y1: 0, x2: 25, y2: 25} as any, 1600, 900)).toBe("1600 / 900");
  });
});

describe("cropperWrapperStyles", () => {
  it("keeps a height when a pixel height is supplied", () => {
    const styles = cropperWrapperStyles(400, 6, false);
    expect(styles["height.px"]).toBe(400);
    expect(styles["aspect-ratio"]).toBeUndefined();
  });

  it("sets aspect-ratio instead of collapsing when there is a crop and no pixel height", () => {
    const styles = cropperWrapperStyles(null, 6, false, {x1: 0, y1: 0, x2: 80, y2: 50} as any);
    expect(styles["height.px"]).toBeUndefined();
    expect(styles["aspect-ratio"]).toBe("80 / 50");
    expect(styles["overflow"]).toBe("hidden");
  });
});
