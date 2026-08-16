import {
  AppAppearance,
  firstCompleted,
  formatDataSize,
  formatMapSaveProgress,
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
