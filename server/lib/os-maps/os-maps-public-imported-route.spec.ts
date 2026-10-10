import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { Request, Response } from "express";
import * as importedStore from "./os-maps-imported-route-store";
import * as listingStore from "./os-maps-route-listing-store";
import { publicImportedOsMapsRoute } from "./os-maps-export-controller";
import { OsMapsImportedRouteRecord } from "../mongo/models/os-maps-imported-route";
import { RouteVisibility } from "../../../projects/ngx-ramblers/src/app/models/os-maps-export.model";

describe("single imported route lookup", () => {
  const sandbox = sinon.createSandbox();
  afterEach(() => sandbox.restore());

  const record = {
    routeId: "recording-fictional-route", number: 42, importedAt: 1700000000000,
    ownerMemberId: "fictional-owner", visibility: RouteVisibility.GROUP,
    gpxFile: {awsFileName: "fictional-route.gpx", title: "Hillside Park"}
  } as OsMapsImportedRouteRecord;

  function response() {
    const res = {status: sandbox.stub(), json: sandbox.stub()};
    res.status.returns(res);
    return res;
  }

  it("opens a numbered recording without reading the full route list", async () => {
    const byNumber = sandbox.stub(importedStore, "osMapsImportedRouteByNumber").resolves(record);
    const list = sandbox.stub(listingStore, "listedImportedOsMapsRoutes").resolves([]);
    const res = response();
    await publicImportedOsMapsRoute({params: {routeId: "42"}, user: {memberId: "fictional-member"}} as unknown as Request, res as unknown as Response);
    expect(byNumber.calledOnceWithExactly(42)).toBe(true);
    expect(list.called).toBe(false);
    expect(res.json.firstCall.args[0]).toMatchObject({id: record.routeId, title: "Hillside Park", number: 42, canEdit: false});
  });

  it("opens an identifier directly and retains owner edit permission", async () => {
    sandbox.stub(importedStore, "osMapsImportedRouteById").resolves(record);
    const list = sandbox.stub(listingStore, "listedImportedOsMapsRoutes").resolves([]);
    const res = response();
    await publicImportedOsMapsRoute({params: {routeId: record.routeId}, user: {memberId: "fictional-owner"}} as unknown as Request, res as unknown as Response);
    expect(list.called).toBe(false);
    expect(res.json.firstCall.args[0].canEdit).toBe(true);
  });

  it("does not expose a private recording to another member", async () => {
    sandbox.stub(importedStore, "osMapsImportedRouteById").resolves({...record, visibility: RouteVisibility.PRIVATE});
    const list = sandbox.stub(listingStore, "listedImportedOsMapsRoutes").resolves([]);
    const res = response();
    await publicImportedOsMapsRoute({params: {routeId: record.routeId}, user: {memberId: "other-fictional-member"}} as unknown as Request, res as unknown as Response);
    expect(res.status.calledOnceWithExactly(404)).toBe(true);
    expect(list.called).toBe(false);
  });

  it("retains the legacy listing fallback when no imported record exists", async () => {
    sandbox.stub(importedStore, "osMapsImportedRouteById").resolves(null);
    const route = listingStore.listedRouteFromImportedRecord(record);
    const list = sandbox.stub(listingStore, "listedImportedOsMapsRoutes").resolves([route]);
    const res = response();
    await publicImportedOsMapsRoute({params: {routeId: record.routeId}, user: {memberId: "fictional-member"}} as unknown as Request, res as unknown as Response);
    expect(list.calledOnce).toBe(true);
    expect(res.json.firstCall.args[0].id).toBe(record.routeId);
  });
});
