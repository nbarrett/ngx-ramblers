import expect from "expect";
import { describe, it } from "mocha";
import { OsMapsListedRoute, OsMapsRouteListFilter, OsMapsRouteSource } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { SortDirection } from "../../../projects/ngx-ramblers/src/app/models/sort.model";
import { pageOsMapsListedRoutes } from "./os-maps-route-listing-page";

function route(partial: Partial<OsMapsListedRoute> & {id: string; title: string}): OsMapsListedRoute {
  return {
    url: "",
    createdAt: "",
    createdAtValue: 0,
    distanceMetres: 0,
    source: OsMapsRouteSource.CREATED,
    ...partial
  };
}

const query = {
  search: "",
  filter: OsMapsRouteListFilter.ALL,
  user: "",
  sortKey: "createdAtValue",
  sortDirection: SortDirection.DESC,
  nearbyOnly: false,
  nearbyMiles: 25,
  latitude: null as number | null,
  longitude: null as number | null,
  favouriteKeys: [] as string[],
  hiddenKeys: [] as string[],
  favouritesOnly: false,
  limit: 2
};

describe("pageOsMapsListedRoutes", () => {
  it("returns only the requested page after sorting by date", () => {
    const routes = [
      route({id: "1", title: "Oldest", createdAtValue: 1}),
      route({id: "2", title: "Middle", createdAtValue: 2}),
      route({id: "3", title: "Newest", createdAtValue: 3})
    ];
    const paged = pageOsMapsListedRoutes(routes, query);
    expect(paged.totalCount).toEqual(3);
    expect(paged.matchedCount).toEqual(3);
    expect(paged.page.map(item => item.id)).toEqual(["3", "2"]);
  });

  it("filters by search before paging", () => {
    const routes = [
      route({id: "1", title: "Hillside Park", createdAtValue: 1}),
      route({id: "2", title: "Riverside", createdAtValue: 2})
    ];
    const paged = pageOsMapsListedRoutes(routes, {...query, search: "hill"});
    expect(paged.matchedCount).toEqual(1);
    expect(paged.page.map(item => item.id)).toEqual(["1"]);
  });

  it("uses stored start coordinates when a route has no GPX file", () => {
    const routes = [
      route({id: "1", title: "Near", startLatitude: 51.42, startLongitude: -1.73}),
      route({id: "2", title: "Far", startLatitude: 55.0, startLongitude: -3.0})
    ];
    const paged = pageOsMapsListedRoutes(routes, {
      ...query,
      nearbyOnly: true,
      nearbyMiles: 11,
      latitude: 51.42,
      longitude: -1.73,
      limit: 10
    });
    expect(paged.page.map(item => item.id)).toEqual(["1"]);
  });
});
