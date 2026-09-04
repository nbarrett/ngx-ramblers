import { directionsLinks, locatePagePath, locateParentPath, locateSuggestionFor, osMapsUrl, wazeEmbedUrl, locationLabel } from "./locate";
import { DirectionsApp } from "../models/locate.model";
import { AppInstallPlatform } from "../models/route-follow.model";

describe("locate links", () => {
  it("builds the Locate page beneath the page it was opened from", () => {
    expect(locatePagePath({gridRef: "TR 24300 57600"}, "/walks/hythe-21")).toBe("/walks/hythe-21/locate?gridRef=TR2430057600");
    expect(locatePagePath({postcode: "CT3 1NE", zoom: 12, provider: "google-maps"}, "/walks/")).toBe("/walks/locate?postcode=CT3%201NE&map-zoom=12&map-provider=google-maps");
    expect(locatePagePath({})).toBe("/locate");
  });

  it("does not nest a Locate page inside another Locate page", () => {
    expect(locatePagePath({gridRef: "TR2430057600"}, "/walks/hythe-21/locate")).toBe("/walks/hythe-21/locate?gridRef=TR2430057600");
    expect(locateParentPath("/walks/hythe-21/locate")).toBe("/walks/hythe-21");
    expect(locateParentPath("/walks/hythe-21")).toBe("/walks/hythe-21");
  });

  it("recognises grid references, postcodes and map words typed into search", () => {
    expect(locateSuggestionFor("tr 243 576")).toEqual({label: "Show grid reference TR243576 on the map", queryParams: {gridRef: "TR243576"}});
    expect(locateSuggestionFor("ct3 1ne")).toEqual({label: "Show postcode CT3 1NE on the map", queryParams: {postcode: "CT3 1NE"}});
    expect(locateSuggestionFor("where is the start")).toEqual({label: "Locate a place on the map", queryParams: {}});
    expect(locateSuggestionFor("Wingham walk")).toBeNull();
  });

  it("offers Apple Maps only on iPhone and iPad, and Waze's web directions elsewhere", () => {
    const phone = directionsLinks(51.2734, 1.2144, AppInstallPlatform.IOS).map(link => link.app);
    const desktop = directionsLinks(51.2734, 1.2144);
    expect(phone).toEqual([DirectionsApp.GOOGLE_MAPS, DirectionsApp.APPLE_MAPS, DirectionsApp.WAZE]);
    expect(desktop.map(link => link.app)).toEqual([DirectionsApp.GOOGLE_MAPS, DirectionsApp.WAZE]);
    expect(desktop.find(link => link.app === DirectionsApp.WAZE).url).toContain("live-map/directions");
    expect(directionsLinks(51.2734, 1.2144, AppInstallPlatform.ANDROID).find(link => link.app === DirectionsApp.WAZE).url).toContain("waze.com/ul");
  });

  it("builds the OS Maps and Waze embed addresses from the point", () => {
    expect(osMapsUrl(51.27338, 1.21436)).toBe("https://explore.osmaps.com/?lat=51.27338&lon=1.21436&zoom=16&style=Leisure");
    expect(wazeEmbedUrl(51.27338, 1.21436)).toBe("https://embed.waze.com/iframe?zoom=16&lat=51.273380&lon=1.214360&pin=1");
  });
});

describe("locationLabel", () => {
  it("prefixes the postcode when the description does not already contain it", () => {
    expect(locationLabel("SS7 4JR", "Castle Point, Essex")).toBe("SS7 4JR, Castle Point, Essex");
  });

  it("does not repeat a postcode already in the description", () => {
    expect(locationLabel("SS7 4JR", "SS7 4JR, Castle Point, Essex, England")).toBe("SS7 4JR, Castle Point, Essex, England");
  });

  it("falls back to the typed term when nothing is known", () => {
    expect(locationLabel("", "", "ss7 4jr")).toBe("ss7 4jr");
  });
});
