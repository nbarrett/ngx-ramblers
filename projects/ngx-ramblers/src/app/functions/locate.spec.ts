import { coordinateValue, googleDrivingDirectionsUrl, googleMapsPlaceUrl, directionsLinks, formattedUkPostcode, locatePagePath, locateParentPath, locateSuggestionFor, osMapsUrl, wazeEmbedUrl, locationLabel, savedPointName, withoutTrailingPostcode } from "./locate";
import { DirectionsApp } from "../models/locate.model";
import { AppInstallPlatform } from "../models/route-follow.model";

describe("locate links", () => {
  it("builds the Locate page beneath the page it was opened from", () => {
    expect(locatePagePath({gridRef: "TR 24300 57600"}, "/walks/hythe-21")).toBe("/walks/hythe-21/locate?gridRef=TR2430057600");
    expect(locatePagePath({postcode: "CT3 1NE", zoom: 12, provider: "google-maps"}, "/walks/")).toBe("/walks/locate?postcode=CT3%201NE&map-zoom=12&map-provider=google-maps");
    expect(locatePagePath({postcode: "CT3 1NE", lat: 51.5012345, lon: -0.1023456}, "/walks")).toBe("/walks/locate?lat=51.5012345&lon=-0.1023456&postcode=CT3%201NE");
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

  it("opens driving navigation at the exact pin without supplying a postcode or overriding the driver's origin", () => {
    const link = googleDrivingDirectionsUrl(51.5012345, -0.1023456);
    expect(link).toBe("https://www.google.com/maps/dir/?api=1&destination=51.5012345,-0.1023456&travelmode=driving&dir_action=navigate");
    expect(directionsLinks(51.5012345, -0.1023456)[0].url).toBe(link);
    expect(googleDrivingDirectionsUrl(null, -0.1)).toBeNull();
    expect(googleDrivingDirectionsUrl(91, -0.1)).toBeNull();
    expect(googleMapsPlaceUrl(51.3055, -1.2605)).toBe("https://www.google.com/maps/search/?api=1&query=51.3055000,-1.2605000");
  });

  it("builds the OS Maps and Waze embed addresses from the point", () => {
    expect(osMapsUrl(51.27338, 1.21436)).toBe("https://explore.osmaps.com/?lat=51.27338&lon=1.21436&zoom=16&style=Leisure");
    expect(wazeEmbedUrl(51.27338, 1.21436)).toBe("https://embed.waze.com/iframe?zoom=16&lat=51.273380&lon=1.214360&pin=1");
  });
});

describe("withoutTrailingPostcode", () => {
  it("removes a postcode appended after a place name", () => {
    expect(withoutTrailingPostcode("Junction of Hillside Lane and Station Approach, Hillside Park, AB1 2CD")).toBe("Junction of Hillside Lane and Station Approach, Hillside Park");
    expect(withoutTrailingPostcode("Hillside Park")).toBe("Hillside Park");
    expect(withoutTrailingPostcode("AB1 2CD")).toBe("AB1 2CD");
  });
});

describe("savedPointName", () => {
  it("uses the first locality from a long reverse-geocode description", () => {
    expect(savedPointName("DA2 7BB", "Wilmington, Sutton-at-Hone & Hawley, Dartford", "TQ 53633 72731")).toBe("Wilmington");
    expect(savedPointName("", "Woolwich Common, Greenwich", "")).toBe("Woolwich Common");
  });

  it("prefers the place description over the postcode", () => {
    expect(savedPointName("SS7 4JR", "Castle Point, Essex", "SU 12345 67890")).toBe("Castle Point");
  });

  it("uses the postcode when no description is known", () => {
    expect(savedPointName("aa11 1aa", "", "SU 12345 67890")).toBe("AA11 1AA");
  });

  it("falls back to the grid reference when nothing else is known", () => {
    expect(savedPointName("", "", "SU 12345 67890")).toBe("SU 12345 67890");
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
    expect(locationLabel("", "", "Hillside Park")).toBe("Hillside Park");
  });

  it("uppercases a postcode used as the fallback label", () => {
    expect(locationLabel("", "", "aa11 1aa")).toBe("AA11 1AA");
  });
});

describe("formattedUkPostcode", () => {
  it("uppercases and spaces a UK postcode", () => {
    expect(formattedUkPostcode("aa111aa")).toBe("AA11 1AA");
    expect(formattedUkPostcode("aa11 1aa")).toBe("AA11 1AA");
  });

  it("leaves a place name unchanged", () => {
    expect(formattedUkPostcode("shoebury")).toBeNull();
    expect(formattedUkPostcode("Hillside Park")).toBeNull();
  });
});

describe("coordinate query values", () => {
  it("rejects missing and non-finite coordinates while accepting zero", () => {
    [null, undefined, "", "invalid", "Infinity", NaN].forEach(value => expect(coordinateValue(value)).toBeNull());
    expect(coordinateValue("0")).toBe(0);
    expect(coordinateValue("51.5")).toBe(51.5);
  });
});
