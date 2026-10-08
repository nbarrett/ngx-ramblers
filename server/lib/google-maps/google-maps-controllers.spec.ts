import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { Request, Response } from "express";
import * as systemConfig from "../config/system-config";
import * as postcodeLookup from "../addresses/postcode-lookup";
import * as placeNameLookup from "../addresses/place-name-lookup";
import { drivingDistance, drivingMilesFromMatrix, milesFromMetres } from "./google-maps-controllers";

describe("google maps driving distance", () => {
  const sandbox = sinon.createSandbox();

  afterEach(() => sandbox.restore());

  it("converts driving metres to miles at one decimal place", () => {
    expect(milesFromMetres(19312)).toEqual(12);
    expect(milesFromMetres(804.672)).toEqual(0.5);
    expect(milesFromMetres(0)).toEqual(0);
  });

  it("reads miles from a Distance Matrix driving result", () => {
    expect(drivingMilesFromMatrix({
      status: "OK",
      rows: [{elements: [{status: "OK", distance: {text: "12.0 mi", value: 19312}}]}]
    })).toEqual({miles: 12, metres: 19312});
  });

  it("does not invent miles when Google has no driving route", () => {
    expect(drivingMilesFromMatrix({
      status: "OK",
      rows: [{elements: [{status: "ZERO_RESULTS"}]}]
    })).toEqual({miles: null, metres: null, error: "ZERO_RESULTS"});
  });

  it("asks Google for a driving route and returns those miles", async () => {
    sandbox.stub(systemConfig, "systemConfig").resolves({googleMaps: {apiKey: "test-key"}} as never);
    const fetchStub = sandbox.stub(globalThis, "fetch").resolves(new globalThis.Response(JSON.stringify({
      status: "OK",
      rows: [{elements: [{status: "OK", distance: {text: "12.0 mi", value: 19312}}]}]
    })));
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.stub()};
    await drivingDistance(
      {query: {from: "AA11 1AA", to: "BB22 2BB"}} as unknown as Request,
      response as unknown as Response
    );
    const requestedUrl = String(fetchStub.firstCall.args[0]);
    expect(requestedUrl).toContain("maps.googleapis.com/maps/api/distancematrix/json");
    expect(requestedUrl).toContain("mode=driving");
    expect(requestedUrl).toContain("origins=AA11+1AA");
    expect(requestedUrl).toContain("destinations=BB22+2BB");
    expect(response.json.firstCall.args[0]).toEqual({
      miles: 12,
      metres: 19312,
      from: "AA11 1AA",
      to: "BB22 2BB"
    });
  });

  it("falls back to a driving router when Google returns no route", async () => {
    sandbox.stub(systemConfig, "systemConfig").resolves({googleMaps: {apiKey: "test-key"}} as never);
    sandbox.stub(postcodeLookup, "postcodeLookupFromPostcodesIo")
      .onFirstCall().resolves({response: {latlng: {lat: 51.1, lng: 0.8}}} as never)
      .onSecondCall().resolves({response: {latlng: {lat: 51.2, lng: 1.1}}} as never);
    const fetchStub = sandbox.stub(globalThis, "fetch");
    fetchStub.onFirstCall().resolves(new globalThis.Response(JSON.stringify({
      status: "OK",
      rows: [{elements: [{status: "ZERO_RESULTS"}]}]
    })));
    fetchStub.onSecondCall().resolves(new globalThis.Response(JSON.stringify({
      routes: [{distance: 19312}]
    })));
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.stub()};
    await drivingDistance(
      {query: {from: "AA11 1AA", to: "BB22 2BB"}} as unknown as Request,
      response as unknown as Response
    );
    expect(String(fetchStub.secondCall.args[0])).toContain("router.project-osrm.org/route/v1/driving");
    expect(response.json.firstCall.args[0]).toEqual({
      miles: 12,
      metres: 19312,
      from: "AA11 1AA",
      to: "BB22 2BB"
    });
  });

  it("rejects a lookup that is missing From or To", async () => {
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.stub()};
    await drivingDistance({query: {from: "AA11 1AA"}} as unknown as Request, response as unknown as Response);
    expect(response.status.firstCall.args).toEqual([400]);
    expect(response.json.firstCall.args[0]).toEqual({
      miles: null,
      metres: null,
      error: "From and To are both needed"
    });
  });

  it("uses supplied coordinates for the driving router without a postcode lookup", async () => {
    sandbox.stub(systemConfig, "systemConfig").resolves({googleMaps: {apiKey: null}} as never);
    const postcodeStub = sandbox.stub(postcodeLookup, "postcodeLookupFromPostcodesIo");
    const fetchStub = sandbox.stub(globalThis, "fetch").resolves(new globalThis.Response(JSON.stringify({
      routes: [{distance: 19312}]
    })));
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.stub()};
    await drivingDistance(
      {query: {from: "Hillside Park", to: "AA11 1AA", fromLat: "51.1", fromLng: "0.8", toLat: "51.2", toLng: "1.1"}} as unknown as Request,
      response as unknown as Response
    );
    expect(postcodeStub.called).toEqual(false);
    expect(String(fetchStub.firstCall.args[0])).toContain("router.project-osrm.org/route/v1/driving/0.8,51.1;1.1,51.2");
    expect(response.json.firstCall.args[0]).toEqual({
      miles: 12,
      metres: 19312,
      from: "Hillside Park",
      to: "AA11 1AA"
    });
  });

  it("looks up a place name when a postcode lookup has no coordinates", async () => {
    sandbox.stub(systemConfig, "systemConfig").resolves({googleMaps: {apiKey: null}} as never);
    sandbox.stub(postcodeLookup, "postcodeLookupFromPostcodesIo").resolves({response: {}} as never);
    sandbox.stub(placeNameLookup, "placeLookupResponse")
      .onFirstCall().resolves({latlng: {lat: 51.1, lng: 0.8}} as never)
      .onSecondCall().resolves({latlng: {lat: 51.2, lng: 1.1}} as never);
    sandbox.stub(globalThis, "fetch").resolves(new globalThis.Response(JSON.stringify({
      routes: [{distance: 19312}]
    })));
    const response = {status: sandbox.stub().returnsThis(), json: sandbox.stub()};
    await drivingDistance(
      {query: {from: "Hillside Park", to: "AA11 1AA"}} as unknown as Request,
      response as unknown as Response
    );
    expect(response.json.firstCall.args[0]).toEqual({
      miles: 12,
      metres: 19312,
      from: "Hillside Park",
      to: "AA11 1AA"
    });
  });
});
