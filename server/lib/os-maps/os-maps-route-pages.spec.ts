import expect from "expect";
import { describe, it } from "mocha";
import { applyLibraryGpxToMapRoute, applyLibraryGpxToTree } from "./os-maps-route-pages";
import { MapRoute } from "../../../projects/ngx-ramblers/src/app/models/content-text.model";

const gpxFile = {rootFolder: "gpx-routes", originalFileName: "hillside.gpx", awsFileName: "new.gpx", title: "Hillside Park"};

describe("library GPX page sync", () => {
  it("rewrites a map route that still has the previous file name", () => {
    const route: MapRoute = {id: "r1", name: "Old", gpxFile: {awsFileName: "old.gpx"}};
    const next = applyLibraryGpxToMapRoute(route, "gpx-new", gpxFile, "old.gpx");
    expect(next.osMapsRouteId).toBe("gpx-new");
    expect(next.gpxFile?.awsFileName).toBe("new.gpx");
    expect(next.name).toBe("Hillside Park");
  });

  it("leaves unrelated map routes unchanged", () => {
    const route: MapRoute = {id: "r2", name: "Other", gpxFile: {awsFileName: "other.gpx"}};
    const next = applyLibraryGpxToMapRoute(route, "gpx-new", gpxFile, "old.gpx");
    expect(next).toEqual(route);
  });

  it("rewrites nested map rows that already know the library route id", () => {
    const rows = [{
      columns: [{
        rows: [{
          map: {
            routes: [{id: "r1", name: "Old", osMapsRouteId: "gpx-new", gpxFile: {awsFileName: "old.gpx"}}]
          }
        }]
      }]
    }];
    const next = applyLibraryGpxToTree(rows, "gpx-new", gpxFile, "old.gpx") as any;
    expect(next[0].columns[0].rows[0].map.routes[0].gpxFile.awsFileName).toBe("new.gpx");
  });
});
