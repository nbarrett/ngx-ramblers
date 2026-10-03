import expect from "expect";
import sinon from "sinon";
import { afterEach, describe, it } from "mocha";
import { Request, Response } from "express";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as routeStore from "../os-maps/os-maps-imported-route-store";
import * as gpxPersist from "./walk-gpx-persist";
import { importWalkGpx } from "./walk-gpx-upload";

const sandbox = sinon.createSandbox();

afterEach(() => sandbox.restore());

function response(): Response {
  const res = {status: sandbox.stub(), json: sandbox.stub()} as unknown as Response;
  (res.status as sinon.SinonStub).returns(res);
  return res;
}

function request(recordingId: string, filePath = "unused"): Request {
  return {file: {originalname: "recording.gpx", path: filePath}, body: {recordingId, title: "Hillside trail", description: "Through woods and fields"}, user: {memberId: "fictional-member"}} as unknown as Request;
}

describe("standalone recording import", () => {
  it("returns the existing route when retrying a completed recording", async () => {
    const gpxFile = {awsFileName: "saved.gpx", title: "Hillside trail"};
    const lookup = sandbox.stub(routeStore, "osMapsImportedRouteById").resolves({routeId: "recording-fictional-id", importedAt: 1, url: "Hillside trail", gpxFile});
    const upload = sandbox.stub(gpxPersist, "persistGpxContent");
    const res = response();
    await importWalkGpx(request("fictional-id"), res);
    expect(lookup.calledOnceWithExactly("recording-fictional-id")).toBe(true);
    expect(upload.called).toBe(false);
    expect((res.json as sinon.SinonStub).firstCall.args[0]).toEqual({gpxFile, routeId: "recording-fictional-id"});
  });

  it("rejects an invalid recording identifier before reading or storing a file", async () => {
    const lookup = sandbox.stub(routeStore, "osMapsImportedRouteById");
    const upload = sandbox.stub(gpxPersist, "persistGpxContent");
    const res = response();
    await importWalkGpx(request("../invalid"), res);
    expect((res.status as sinon.SinonStub).calledWith(400)).toBe(true);
    expect(lookup.called).toBe(false);
    expect(upload.called).toBe(false);
  });

  it("stores the name, description and recording identifier through the shared import", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "recording-import-test-"));
    const filePath = path.join(directory, "recording.gpx");
    fs.writeFileSync(filePath, "<gpx/>");
    try {
      sandbox.stub(routeStore, "osMapsImportedRouteById").resolves(null);
      const upload = sandbox.stub(gpxPersist, "persistGpxContent").resolves({rootFolder: "gpx-routes", originalFileName: "recording.gpx", awsFileName: "saved.gpx", title: "Hillside trail"});
      const store = sandbox.stub(routeStore, "saveFileImportedGpx").resolves({routeId: "recording-fictional-id", importedAt: 1, url: "Hillside trail"});
      const res = response();
      await importWalkGpx(request("fictional-id", filePath), res);
      expect(upload.firstCall.args[2]).toBe("Hillside trail");
      expect(store.firstCall.args[0].description).toBe("Through woods and fields");
      expect(store.firstCall.args[1]).toBe("fictional-id");
      expect((res.status as sinon.SinonStub).calledWith(200)).toBe(true);
    } finally {
      fs.rmSync(directory, {recursive: true});
    }
  });
});
