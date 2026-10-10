import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { Request, Response } from "express";
import { MemberCookie } from "../../../projects/ngx-ramblers/src/app/models/member.model";
import { OsMapsAccountScope, OsMapsListedRoute, OsMapsRouteSource, RouteVisibility } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";
import { accessibleRoutes, canEditImportedRoute, canViewImportedRoute } from "./os-maps-route-access";
import * as importedStore from "./os-maps-imported-route-store";
import * as listingStore from "./os-maps-route-listing-store";
import * as results from "./os-maps-export-result-store";
import * as dispatcher from "../ramblers/os-maps-export-dispatcher";
import { exportOsMapsRoute, publicImportedOsMapsRoute, osMapsExportJobResult, updateOsMapsImportedRoute } from "./os-maps-export-controller";

const owner = {memberId: "alex"} as MemberCookie;
const other = {memberId: "robin"} as MemberCookie;
const admin = {memberId: "admin", walkAdmin: true} as MemberCookie;
const route: OsMapsListedRoute = {id: "1001", title: "Hillside Park", url: "https://explore.osmaps.com/route/1001",
  source: OsMapsRouteSource.CREATED, createdAt: "", createdAtValue: 0, distanceMetres: 1000,
  importedAt: 1, ownerMemberId: owner.memberId, visibility: RouteVisibility.PRIVATE, gpxFile: {awsFileName: "hillside.gpx"}};

describe("member route permissions", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  it("keeps private routes visible only to their owner and administrators", () => {
    expect(canViewImportedRoute(route, owner)).toBe(true);
    expect(canViewImportedRoute(route, admin)).toBe(true);
    expect(canViewImportedRoute(route, other)).toBe(false);
    expect(canViewImportedRoute(route, null)).toBe(false);
    expect(accessibleRoutes([route], other)).toEqual([]);
  });

  it("shares group routes with members but permits only the owner or administrator to edit", () => {
    const shared = {...route, visibility: RouteVisibility.GROUP};
    expect(canViewImportedRoute(shared, other)).toBe(true);
    expect(canViewImportedRoute(shared, null)).toBe(false);
    expect(canEditImportedRoute(shared, other)).toBe(false);
    expect(canEditImportedRoute(shared, owner)).toBe(true);
    expect(canEditImportedRoute(shared, admin)).toBe(true);
  });

  it("keeps existing public routes accessible without granting members edit access", () => {
    expect(canViewImportedRoute({...route, visibility: null, ownerMemberId: null}, null)).toBe(true);
    expect(canEditImportedRoute({...route, visibility: null, ownerMemberId: null}, other)).toBe(false);
  });

  it("does not expose a private route through a guessed route id", async () => {
    sandbox.stub(importedStore, "osMapsImportedRouteByNumber").resolves({...route, routeId: route.id, number: 1001});
    const response = {status: sinon.stub(), json: sinon.stub()};
    response.status.returns(response);
    await publicImportedOsMapsRoute({user: other, params: {routeId: route.id}} as unknown as Request, response as unknown as Response);
    expect(response.status.calledWith(404)).toBe(true);
    expect(response.json.firstCall.args[0]).not.toHaveProperty("gpxFile");
  });

  it("rejects an attempt to edit another member's route before writing", async () => {
    sandbox.stub(importedStore, "osMapsImportedRouteById").resolves({...route, routeId: route.id});
    const save = sandbox.stub(importedStore, "saveOsMapsImportedRoute");
    const response = {status: sinon.stub(), json: sinon.stub()};
    response.status.returns(response);
    await updateOsMapsImportedRoute({user: other, params: {routeId: route.id}, body: {visibility: RouteVisibility.GROUP}} as unknown as Request, response as unknown as Response);
    expect(response.status.calledWith(403)).toBe(true);
    expect(save.called).toBe(false);
  });

  it("rejects imports outside a member's personal account listing", async () => {
    sandbox.stub(listingStore, "latestOsMapsRouteListing").resolves({listedAt: 1, routes: []});
    sandbox.stub(results, "latestOsMapsExportResult").resolves(null);
    const dispatch = sandbox.stub(dispatcher, "dispatchOsMapsExport");
    const response = {status: sinon.stub(), json: sinon.stub()};
    response.status.returns(response);
    await exportOsMapsRoute({user: other, body: {routeUrls: [route.url]}} as unknown as Request, response as unknown as Response);
    expect(response.status.calledWith(403)).toBe(true);
    expect(dispatch.called).toBe(false);
  });

  it("imports from the authenticated member's account with private visibility by default", async () => {
    const listing = sandbox.stub(listingStore, "latestOsMapsRouteListing").resolves({listedAt: 1, routes: [{...route, importedAt: 0, gpxFile: null, visibility: null, ownerMemberId: null}]});
    sandbox.stub(results, "latestOsMapsExportResult").resolves(null);
    const dispatch = sandbox.stub(dispatcher, "dispatchOsMapsExport").resolves({jobId: "personal-job"} as never);
    const response = {status: sinon.stub(), json: sinon.stub()};
    response.status.returns(response);
    await exportOsMapsRoute({user: owner, body: {routeUrls: [route.url], account: OsMapsAccountScope.GROUP, ownerMemberId: "robin"}} as unknown as Request, response as unknown as Response);
    expect(listing.calledWith(owner.memberId)).toBe(true);
    expect(dispatch.firstCall.args[4]).toEqual({ownerMemberId: owner.memberId, accountOwnerId: owner.memberId, visibility: RouteVisibility.PRIVATE});
  });

  it("does not expose another member's job result", async () => {
    sandbox.stub(results, "osMapsExportResultByJobId").resolves({jobId: "private-job", contributor: {memberId: owner.memberId}} as never);
    const response = {status: sinon.stub(), json: sinon.stub()};
    response.status.returns(response);
    await osMapsExportJobResult({user: other, params: {jobId: "private-job"}} as unknown as Request, response as unknown as Response);
    expect(response.status.calledWith(404)).toBe(true);
  });
});
