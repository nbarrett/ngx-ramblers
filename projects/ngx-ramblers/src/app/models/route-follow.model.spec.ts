import {
  AppAppearance,
  compassCardinal,
  compassHeadingLabel,
  compassTapeMarks,
  CompassCardinal,
  editExtendAfterIndex,
  firstCompleted,
  followLineColours,
  routeEndsJoined,
  followMapScaleBar,
  formatDataSize,
  formatMapSaveProgress,
  formatOsGridReference,
  nextAppAppearance,
  RouteFollowProgressPaint,
  RouteFollowSheetState,
  routeFollowProgressPaintFrom,
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

describe("editExtendAfterIndex", () => {

  const openLine = [
    {latitude: 51.2, longitude: 1.0},
    {latitude: 51.2, longitude: 1.01},
    {latitude: 51.2, longitude: 1.02}
  ];

  it("grows from the nearer open end", () => {
    expect(editExtendAfterIndex(openLine, {latitude: 51.2, longitude: 0.99})).toEqual(-1);
    expect(editExtendAfterIndex(openLine, {latitude: 51.2, longitude: 1.03})).toEqual(2);
  });

  it("stays on the finish when the ends already meet", () => {
    const loop = [...openLine, {latitude: 51.2, longitude: 1.0}];
    expect(routeEndsJoined(loop)).toEqual(true);
    expect(editExtendAfterIndex(loop, {latitude: 51.21, longitude: 0.99})).toEqual(3);
  });

});

describe("followLineColours", () => {

  it("colours the walked stretch by default", () => {
    expect(followLineColours(RouteFollowProgressPaint.COLOUR_WALKED, "#c21d4b", "#8aa0c8"))
      .toEqual({walked: "#c21d4b", ahead: "#8aa0c8"});
  });

  it("can colour the remaining stretch instead", () => {
    expect(followLineColours(RouteFollowProgressPaint.COLOUR_AHEAD, "#c21d4b", "#8aa0c8"))
      .toEqual({walked: "#8aa0c8", ahead: "#c21d4b"});
  });

});

describe("routeFollowProgressPaintFrom", () => {

  it("defaults to colouring the walked stretch", () => {
    expect(routeFollowProgressPaintFrom(null)).toEqual(RouteFollowProgressPaint.COLOUR_WALKED);
    expect(routeFollowProgressPaintFrom("colour-ahead")).toEqual(RouteFollowProgressPaint.COLOUR_AHEAD);
  });

});

describe("compassCardinal", () => {

  it("uses eight 45-degree winds", () => {
    expect(compassCardinal(0)).toEqual(CompassCardinal.N);
    expect(compassCardinal(180)).toEqual(CompassCardinal.S);
    expect(compassCardinal(198)).toEqual(CompassCardinal.S);
    expect(compassCardinal(225)).toEqual(CompassCardinal.SW);
    expect(compassCardinal(270)).toEqual(CompassCardinal.W);
  });

});

describe("compassTapeMarks", () => {

  it("places south at the centre when heading south", () => {
    const marks = compassTapeMarks(180, 80, 4);
    const south = marks.find(mark => mark.label === CompassCardinal.S);
    expect(south).toBeTruthy();
    expect(south.offsetPx).toBeCloseTo(0, 5);
  });

  it("keeps south just left of the needle at 198 degrees", () => {
    const marks = compassTapeMarks(198, 200, 2.3);
    const south = marks.find(mark => mark.label === CompassCardinal.S);
    const southwest = marks.find(mark => mark.label === CompassCardinal.SW);
    const west = marks.find(mark => mark.label === CompassCardinal.W);
    const southeast = marks.find(mark => mark.label === CompassCardinal.SE);
    expect(south.offsetPx).toBeCloseTo((180 - 198) * 2.3, 5);
    expect(southwest.offsetPx).toBeCloseTo((225 - 198) * 2.3, 5);
    expect(south.offsetPx).toBeLessThan(0);
    expect(southwest.offsetPx).toBeGreaterThan(0);
    expect(southeast).toBeTruthy();
    expect(west).toBeTruthy();
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
    const scale = followMapScaleBar(1000 * 0.3048 / 160, 160, 200);
    expect(scale.label).toEqual("1,000 ft");
    expect(scale.midLabel).toEqual("500 ft");
    expect(scale.widthPx).toBeGreaterThanOrEqual(156);
    expect(scale.widthPx).toBeLessThanOrEqual(164);
  });

  it("returns an empty bar when the resolution is not usable", () => {
    expect(followMapScaleBar(0)).toEqual({label: "", midLabel: "", widthPx: 0});
    expect(followMapScaleBar(-2)).toEqual({label: "", midLabel: "", widthPx: 0});
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
