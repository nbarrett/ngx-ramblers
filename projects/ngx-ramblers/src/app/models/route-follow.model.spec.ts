import {
  AppAppearance,
  compassHeadingLabel,
  firstCompleted,
  followMapScaleBar,
  formatDataSize,
  formatMapSaveProgress,
  formatOsGridReference,
  nextAppAppearance,
  RouteFollowSheetState,
  sheetStateAfterDrag
} from "./route-follow.model";

describe("formatMapSaveProgress", () => {

  it("shows a percent and a readable size", () => {
    expect(formatMapSaveProgress(437, 500, 4.2 * 1024 * 1024))
      .toEqual("Saving the map for offline use… 87% (4.2 MB)");
  });

  it("falls back to a percent when no size is known yet", () => {
    expect(formatMapSaveProgress(1, 4, 0)).toEqual("Saving the map for offline use… 25%");
  });

});

describe("formatDataSize", () => {

  it("uses KB and MB for larger amounts", () => {
    expect(formatDataSize(800)).toEqual("800 bytes");
    expect(formatDataSize(12 * 1024)).toEqual("12 KB");
    expect(formatDataSize(4.2 * 1024 * 1024)).toEqual("4.2 MB");
  });

});

describe("nextAppAppearance", () => {

  it("jumps from match-phone to the opposite of the current system theme", () => {
    expect(nextAppAppearance(AppAppearance.SYSTEM, false)).toEqual(AppAppearance.DARK);
    expect(nextAppAppearance(AppAppearance.SYSTEM, true)).toEqual(AppAppearance.LIGHT);
  });

  it("toggles between light and dark after the first choice", () => {
    expect(nextAppAppearance(AppAppearance.LIGHT, false)).toEqual(AppAppearance.DARK);
    expect(nextAppAppearance(AppAppearance.DARK, false)).toEqual(AppAppearance.LIGHT);
  });

});

describe("firstCompleted", () => {

  it("returns the value when the work finishes in time", async () => {
    await expect(firstCompleted(Promise.resolve("ready"), 50, "timed out")).resolves.toEqual("ready");
  });

  it("rejects when the timeout wins", async () => {
    await expect(firstCompleted(new Promise<string>(() => undefined), 1, "timed out")).rejects.toThrow("timed out");
  });

});

describe("sheetStateAfterDrag", () => {

  it("expands when dragged up past the threshold", () => {
    expect(sheetStateAfterDrag(RouteFollowSheetState.MINIMISED, -40)).toEqual(RouteFollowSheetState.EXPANDED);
  });

  it("minimises when dragged down past the threshold", () => {
    expect(sheetStateAfterDrag(RouteFollowSheetState.EXPANDED, 40)).toEqual(RouteFollowSheetState.MINIMISED);
  });

  it("keeps the current state for a short drag", () => {
    expect(sheetStateAfterDrag(RouteFollowSheetState.MINIMISED, -10)).toEqual(RouteFollowSheetState.MINIMISED);
    expect(sheetStateAfterDrag(RouteFollowSheetState.EXPANDED, 10)).toEqual(RouteFollowSheetState.EXPANDED);
  });

});

describe("compassHeadingLabel", () => {

  it("wraps headings into 0-359 degrees", () => {
    expect(compassHeadingLabel(12.4)).toEqual("12°");
    expect(compassHeadingLabel(-20)).toEqual("340°");
    expect(compassHeadingLabel(370)).toEqual("10°");
  });

  it("returns an empty label when the heading is not a number", () => {
    expect(compassHeadingLabel(Number.NaN)).toEqual("");
  });

});

describe("followMapScaleBar", () => {

  it("picks a round feet label near the target width", () => {
    const scale = followMapScaleBar(1000 * 0.3048 / 72);
    expect(scale.label).toEqual("1000 ft");
    expect(scale.widthPx).toBeGreaterThanOrEqual(70);
    expect(scale.widthPx).toBeLessThanOrEqual(74);
  });

  it("returns an empty bar when the resolution is not usable", () => {
    expect(followMapScaleBar(0)).toEqual({label: "", widthPx: 0});
    expect(followMapScaleBar(-2)).toEqual({label: "", widthPx: 0});
  });

});

describe("formatOsGridReference", () => {

  it("formats a Kent point as a spaced 10-digit reference", () => {
    expect(formatOsGridReference(589060, 140509)).toEqual("TQ 89060 40509");
  });

  it("returns an empty string outside the OS grid", () => {
    expect(formatOsGridReference(-1, 140509)).toEqual("");
    expect(formatOsGridReference(589060, Number.NaN)).toEqual("");
  });

});
