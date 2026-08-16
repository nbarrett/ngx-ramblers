import expect from "expect";
import { describe, it } from "mocha";
import {
  libraryRouteFromPage,
  ramblersRouteSlugFrom
} from "./library-route-lookup";

describe("ramblers library route lookup", () => {

  describe("ramblersRouteSlugFrom", () => {

    it("accepts a full Ramblers route URL", () => {
      expect(ramblersRouteSlugFrom("https://www.ramblers.org.uk/go-walking/routes/egerton-kent"))
        .toEqual("egerton-kent");
    });

    it("accepts a path or a bare slug", () => {
      expect(ramblersRouteSlugFrom("/go-walking/routes/egerton-kent")).toEqual("egerton-kent");
      expect(ramblersRouteSlugFrom("egerton-kent")).toEqual("egerton-kent");
    });

    it("rejects other sites and empty values", () => {
      expect(ramblersRouteSlugFrom("https://example.com/go-walking/routes/egerton-kent")).toEqual(null);
      expect(ramblersRouteSlugFrom("https://www.ramblers.org.uk/go-walking")).toEqual(null);
      expect(ramblersRouteSlugFrom("")).toEqual(null);
    });
  });

  describe("libraryRouteFromPage", () => {

    it("maps public route fields and a start waypoint when there is no line", () => {
      const route = libraryRouteFromPage({
        type: "route",
        title: "Egerton, Kent",
        description: "Circular walk from Egerton",
        startDescription: "Egerton village green",
        startLatitude: 51.1950384,
        startLongitude: 0.7290869,
        milesValue: "8.3",
        content: {
          duration: 240,
          difficulty: "Moderate",
          shape: "circular",
          start_location: {
            latitude: 51.1950384,
            longitude: 0.7290869,
            description: "Egerton Village green next to church TN27 9DJ"
          },
          geojson: "",
          gpx: "",
          instructions: []
        }
      }, "egerton-kent", "https://www.ramblers.org.uk/go-walking/routes/egerton-kent");

      expect(route.title).toEqual("Egerton, Kent");
      expect(route.distanceMiles).toEqual(8.3);
      expect(route.durationMinutes).toEqual(240);
      expect(route.hasLine).toEqual(false);
      expect(route.points).toEqual([]);
      expect(route.waypoints.length).toEqual(1);
      expect(route.waypoints[0].label).toEqual("Start");
      expect(route.waypoints[0].latitude).toEqual(51.1950384);
    });

    it("reads a GeoJSON line when Ramblers publish one", () => {
      const route = libraryRouteFromPage({
        title: "Test",
        startLatitude: 51.2,
        startLongitude: 0.7,
        content: {
          geojson: {
            type: "LineString",
            coordinates: [[0.7, 51.2], [0.71, 51.21], [0.72, 51.22]]
          },
          instructions: [
            {latitude: 51.2, longitude: 0.7, instruction: "Leave the green"},
            {lat: 51.21, lng: 0.71, text: "Turn left at the orchard"}
          ]
        }
      }, "test", "https://www.ramblers.org.uk/go-walking/routes/test");

      expect(route.hasLine).toEqual(true);
      expect(route.points.length).toEqual(3);
      expect(route.waypoints.length).toEqual(2);
      expect(route.waypoints[1].instruction).toEqual("Turn left at the orchard");
    });
  });
});
