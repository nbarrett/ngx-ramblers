import expect from "expect";
import { describe, it } from "mocha";
import { allListedRoutesFromSearchPages, listedRoutesFromSearchPayload } from "./os-maps-route-list";
import { osMapsRouteIdFromUrl, OsMapsRouteSource } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { withImportedAt } from "./os-maps-imported-route-store";

describe("os-maps-route-list", () => {

  it("maps a search payload to listed routes", () => {
    const routes = listedRoutesFromSearchPayload({
      content: [{
        id: "1001",
        metadata: {name: "Hillside Park Circular", createdAt: "2025-11-10T21:52:17.878735Z"},
        characteristics: {distance: 10581.24}
      }]
    }, OsMapsRouteSource.CREATED);
    expect(routes.length).toEqual(1);
    expect(routes[0].id).toEqual("1001");
    expect(routes[0].title).toEqual("Hillside Park Circular");
    expect(routes[0].url).toEqual("https://explore.osmaps.com/route/1001");
    expect(routes[0].createdAtValue).toBeGreaterThan(0);
    expect(routes[0].distanceMetres).toEqual(10581.24);
    expect(routes[0].source).toEqual(OsMapsRouteSource.CREATED);
  });

  it("returns an empty list for unrecognised payloads", () => {
    expect(listedRoutesFromSearchPayload({}, OsMapsRouteSource.CREATED)).toEqual([]);
  });

  it("reads a route id from an OS Maps url", () => {
    expect(osMapsRouteIdFromUrl("https://explore.osmaps.com/route/1001/-hillside-park")).toEqual("1001");
  });

  it("applies stored imported dates onto listed routes", () => {
    const routes = listedRoutesFromSearchPayload({
      content: [{
        id: "1001",
        metadata: {name: "Hillside Park Circular", createdAt: "2025-11-10T21:52:17.878735Z"},
        characteristics: {distance: 10581.24}
      }]
    }, OsMapsRouteSource.CREATED);
    const merged = withImportedAt(routes, {"1001": {routeId: "1001", number: 1, url: routes[0].url, importedAt: 1700000000000}});
    expect(merged[0].importedAt).toEqual(1700000000000);
  });

  it("fetches every page and removes repeated route IDs", async () => {
    const requested: number[] = [];
    const result = await allListedRoutesFromSearchPages({
      content: [{id: "1001"}, {id: "1002"}], number: 0, totalPages: 2, totalElements: 3, last: false
    }, OsMapsRouteSource.CREATED, async page => {
      requested.push(page);
      return {content: [{id: "1002"}, {id: "1003"}], number: 1, totalPages: 2, totalElements: 3, last: true};
    });
    expect(requested).toEqual([1]);
    expect(result.map(route => route.id)).toEqual(["1001", "1002", "1003"]);
  });

  it("does not request more pages when the first page is complete", async () => {
    const result = await allListedRoutesFromSearchPages({
      content: [{id: "1001"}], number: 0, totalPages: 1, totalElements: 1, last: true
    }, OsMapsRouteSource.CREATED, async () => {throw new Error("Unexpected additional page");});
    expect(result.length).toEqual(1);
  });

  it("rejects an incomplete final page", async () => {
    await expect(allListedRoutesFromSearchPages({
      content: [{id: "1001"}], number: 0, totalPages: 1, totalElements: 2, last: true
    }, OsMapsRouteSource.CREATED, async () => null)).rejects.toThrow("previous listing has been retained");
  });

  it("rejects a server that repeats the previous page", async () => {
    const page = {content: [{id: "1001"}], number: 0, totalPages: 2, totalElements: 2, last: false};
    await expect(allListedRoutesFromSearchPages(page, OsMapsRouteSource.CREATED, async () => page))
      .rejects.toThrow("did not return requested route page 2");
  });

  it("propagates a later page failure", async () => {
    await expect(allListedRoutesFromSearchPages({
      content: [{id: "1001"}], number: 0, totalPages: 2, totalElements: 2, last: false
    }, OsMapsRouteSource.CREATED, async () => {throw new Error("Page unavailable");})).rejects.toThrow("Page unavailable");
  });

});
