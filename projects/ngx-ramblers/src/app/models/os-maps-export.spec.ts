import { OsMapsListedRoute, OsMapsRouteListFilter, OsMapsRouteSource, osMapsRouteIdFromUrl, osMapsRouteUserNames, osMapsRouteVisible } from "./os-maps-export.model";

describe("os-maps-export helpers", () => {
  const nickWalk: OsMapsListedRoute = {
    id: "1",
    title: "-nick--elham-valley-north",
    url: "https://explore.osmaps.com/route/1/-nick--elham-valley-north",
    createdAt: "",
    createdAtValue: 1,
    distanceMetres: 1000,
    source: OsMapsRouteSource.CREATED,
    importedAt: null,
    walkedByName: "Alex Reed"
  };
  const importedWalk: OsMapsListedRoute = {
    ...nickWalk,
    id: "2",
    title: "Saturday club walk",
    importedAt: 1,
    walkedByName: null,
    gpxFile: {
      createdByName: "Jordan Lee",
      walkedByName: "Sam Patel"
    }
  };

  it("reads the OS Maps route id from a route url", () => {
    expect(osMapsRouteIdFromUrl("https://explore.osmaps.com/route/29532353/-nick--elham")).toBe("29532353");
    expect(osMapsRouteIdFromUrl("https://example.com/not-os")).toBeNull();
  });

  it("finds walks by a partial title search", () => {
    expect(osMapsRouteVisible(nickWalk, "nick", OsMapsRouteListFilter.ALL)).toBe(true);
    expect(osMapsRouteVisible(nickWalk, "club", OsMapsRouteListFilter.ALL)).toBe(false);
  });

  it("keeps imported and not-imported walks apart", () => {
    expect(osMapsRouteVisible(nickWalk, "", OsMapsRouteListFilter.NOT_IMPORTED)).toBe(true);
    expect(osMapsRouteVisible(importedWalk, "", OsMapsRouteListFilter.NOT_IMPORTED)).toBe(false);
    expect(osMapsRouteVisible(importedWalk, "", OsMapsRouteListFilter.IMPORTED)).toBe(true);
  });

  it("lists walked-by and imported-by names for a route", () => {
    expect(osMapsRouteUserNames(nickWalk)).toEqual(["Alex Reed"]);
    expect(osMapsRouteUserNames(importedWalk)).toEqual(["Sam Patel", "Jordan Lee"]);
    expect(osMapsRouteUserNames({
      ...importedWalk,
      walkedByName: "Unknown user",
      gpxFile: {createdByName: "Unknown user"}
    })).toEqual([]);
  });

  it("filters by walked-by or imported-by user", () => {
    expect(osMapsRouteVisible(nickWalk, "", OsMapsRouteListFilter.ALL, "Alex Reed")).toBe(true);
    expect(osMapsRouteVisible(nickWalk, "", OsMapsRouteListFilter.ALL, "Jordan Lee")).toBe(false);
    expect(osMapsRouteVisible(importedWalk, "", OsMapsRouteListFilter.ALL, "Jordan Lee")).toBe(true);
    expect(osMapsRouteVisible(importedWalk, "", OsMapsRouteListFilter.ALL, "Sam Patel")).toBe(true);
    expect(osMapsRouteVisible(importedWalk, "", OsMapsRouteListFilter.ALL, "Alex Reed")).toBe(false);
  });
});
