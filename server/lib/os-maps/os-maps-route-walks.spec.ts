import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { Request, Response } from "express";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { OsMapsListedRoute, OsMapsRouteSource } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { StoredValue } from "../../../projects/ngx-ramblers/src/app/models/ui-actions";
import { walkReferencesRoute, withRouteWalks } from "./os-maps-route-walks";
import * as references from "./os-maps-route-walks";
import * as listingStore from "./os-maps-route-listing-store";
import { deleteOsMapsRoute } from "./os-maps-export-controller";

const route: OsMapsListedRoute = {
  id: "1001", number: 17, title: "Hillside Park", url: "https://explore.osmaps.com/route/1001",
  createdAt: "", createdAtValue: 0, distanceMetres: 1000, source: OsMapsRouteSource.CREATED,
  gpxFile: {awsFileName: "hillside.gpx"}
};

function walk(href: string | null = null, fileName: string | null = null): ExtendedGroupEvent {
  return {
    id: "walk-one",
    groupEvent: {title: "Hillside walk", start_date_time: "2026-10-04T10:00:00+01:00", url: "https://group.example.org.uk/walks/hillside"},
    fields: {links: href ? [{href}] : [], gpxFile: fileName ? {awsFileName: fileName} : null}
  } as ExtendedGroupEvent;
}

describe("route walk references", () => {
  it("finds attached GPX files and OS Maps links independently", () => {
    expect(walkReferencesRoute(walk(null, "hillside.gpx"), route)).toBe(true);
    expect(walkReferencesRoute(walk("https://explore.osmaps.com/route/1001/hillside?view=map"), route)).toBe(true);
  });

  it("recognises numbered and legacy app links without matching other routes", () => {
    expect(walkReferencesRoute(walk("/app/route/17/hillside"), route)).toBe(true);
    expect(walkReferencesRoute(walk(`/app/follow?${StoredValue.OS_MAPS_ROUTE_ID}=1001`), route)).toBe(true);
    expect(walkReferencesRoute(walk(`/app/route?${StoredValue.OS_MAPS_ROUTE_ID}=1001`), route)).toBe(true);
    expect(walkReferencesRoute(walk(`/app/route?${StoredValue.ROUTE}=1001/hillside`), route)).toBe(true);
    expect(walkReferencesRoute(walk("/app/route/170/hillside"), route)).toBe(false);
    expect(walkReferencesRoute(walk("https://group.example.org.uk/route/1001"), route)).toBe(false);
    expect(walkReferencesRoute(walk(null, "other.gpx"), route)).toBe(false);
  });

  it("lists a walk once when both its link and GPX file match, with a usable destination", () => {
    const result = withRouteWalks([route], [walk(route.url, "hillside.gpx"), walk(null, "other.gpx")]);
    expect(result[0].walks).toEqual([{id: "walk-one", slug: "hillside", title: "Hillside walk", startDateTime: "2026-10-04T10:00:00+01:00"}]);
  });

  it("does not match two routes merely because their titles are the same", () => {
    expect(withRouteWalks([route], [walk()])[0].walks).toEqual([]);
  });
});

describe("delete route protection", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("rejects deletion when a walk links to the route, even without a UI check", async () => {
    sandbox.stub(listingStore, "latestOsMapsRouteListing").resolves({listedAt: 1, routes: [route]});
    sandbox.stub(listingStore, "listedImportedOsMapsRoutes").resolves([route]);
    sandbox.stub(references, "routesWithWalkReferences").resolves(withRouteWalks([route], [walk(route.url)]));
    const remove = sandbox.stub(listingStore, "removeOsMapsRouteFromApp").resolves();
    const response = {status: sinon.stub(), json: sinon.stub()};
    response.status.returns(response);
    await deleteOsMapsRoute({params: {routeId: route.id}} as unknown as Request, response as unknown as Response);
    expect(response.status.calledWith(409)).toBe(true);
    expect(remove.called).toBe(false);
  });

  it("rejects deletion of a route that has not been imported", async () => {
    const unimported = {...route, gpxFile: null};
    sandbox.stub(listingStore, "latestOsMapsRouteListing").resolves({listedAt: 1, routes: [unimported]});
    sandbox.stub(listingStore, "listedImportedOsMapsRoutes").resolves([]);
    sandbox.stub(references, "routesWithWalkReferences").resolves(withRouteWalks([unimported], []));
    const remove = sandbox.stub(listingStore, "removeOsMapsRouteFromApp").resolves();
    const response = {status: sinon.stub(), json: sinon.stub()};
    response.status.returns(response);
    await deleteOsMapsRoute({params: {routeId: route.id}} as unknown as Request, response as unknown as Response);
    expect(response.status.calledWith(409)).toBe(true);
    expect(remove.called).toBe(false);
  });

  it("removes an unreferenced route from the app", async () => {
    sandbox.stub(listingStore, "latestOsMapsRouteListing").resolves({listedAt: 1, routes: [route]});
    sandbox.stub(listingStore, "listedImportedOsMapsRoutes").resolves([route]);
    sandbox.stub(references, "routesWithWalkReferences").resolves(withRouteWalks([route], []));
    const remove = sandbox.stub(listingStore, "removeOsMapsRouteFromApp").resolves();
    const response = {status: sinon.stub(), json: sinon.stub()};
    response.status.returns(response);
    await deleteOsMapsRoute({params: {routeId: route.id}} as unknown as Request, response as unknown as Response);
    expect(remove.calledOnceWithExactly(route.id)).toBe(true);
    expect(response.json.calledWith({deleted: true})).toBe(true);
  });
});
