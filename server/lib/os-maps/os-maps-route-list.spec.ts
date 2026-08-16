import expect from "expect";
import { describe, it } from "mocha";
import { listedRoutesFromSearchPayload } from "./os-maps-route-list";
import { osMapsRouteIdFromUrl, OsMapsRouteSource } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { withImportedAt } from "./os-maps-imported-route-store";

describe("os-maps-route-list", () => {

  it("maps a search payload to listed routes", () => {
    const routes = listedRoutesFromSearchPayload({
      content: [{
        id: "29532353",
        metadata: {name: "Elham Valley North", createdAt: "2025-11-10T21:52:17.878735Z"},
        characteristics: {distance: 10581.24}
      }]
    }, OsMapsRouteSource.CREATED);
    expect(routes.length).toEqual(1);
    expect(routes[0].id).toEqual("29532353");
    expect(routes[0].title).toEqual("Elham Valley North");
    expect(routes[0].url).toEqual("https://explore.osmaps.com/route/29532353");
    expect(routes[0].createdAtValue).toBeGreaterThan(0);
    expect(routes[0].distanceMetres).toEqual(10581.24);
    expect(routes[0].source).toEqual(OsMapsRouteSource.CREATED);
  });

  it("returns an empty list for unrecognised payloads", () => {
    expect(listedRoutesFromSearchPayload({}, OsMapsRouteSource.CREATED)).toEqual([]);
  });

  it("reads a route id from an OS Maps url", () => {
    expect(osMapsRouteIdFromUrl("https://explore.osmaps.com/route/29532353/-nick--elham")).toEqual("29532353");
  });

  it("applies stored imported dates onto listed routes", () => {
    const routes = listedRoutesFromSearchPayload({
      content: [{
        id: "29532353",
        metadata: {name: "Elham Valley North", createdAt: "2025-11-10T21:52:17.878735Z"},
        characteristics: {distance: 10581.24}
      }]
    }, OsMapsRouteSource.CREATED);
    const merged = withImportedAt(routes, {"29532353": {routeId: "29532353", url: routes[0].url, importedAt: 1700000000000}});
    expect(merged[0].importedAt).toEqual(1700000000000);
  });

});
