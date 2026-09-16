import expect from "expect";
import sinon from "sinon";
import { afterEach, beforeEach, describe, it } from "mocha";
import { RootFolder } from "../../../projects/ngx-ramblers/src/app/models/system.model";
import { ExtendedGroupEvent } from "../../../projects/ngx-ramblers/src/app/models/group-event.model";
import { FileNameData } from "../../../projects/ngx-ramblers/src/app/models/aws-object.model";
import * as awsControllers from "../aws/aws-controllers";
import * as walkGpxRecords from "./walk-gpx-records";
import { walkGpxFileList } from "./walk-gpx-list";

const CHILHAM_GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="test"><trk><name>Chilham</name><trkseg><trkpt lat="51.2432" lon="0.9613"></trkpt><trkpt lat="51.2440" lon="0.9620"></trkpt></trkseg></trk></gpx>`;
const EMPTY_GPX = `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="test"></gpx>`;
const UUID_FILE = "0f8a9d2e-5b1c-4e7a-9c3d-2a1b4c5d6e7f.gpx";

function walkWith(gpxFile: FileNameData, startLocation?: {latitude: number; longitude: number}): ExtendedGroupEvent {
  return {
    groupEvent: {title: "Chilham circular", start_date_time: "2026-05-03T10:00:00", start_location: startLocation},
    fields: {gpxFile}
  } as ExtendedGroupEvent;
}

describe("walkGpxFileList", () => {
  let sandbox: sinon.SinonSandbox;
  let walks: sinon.SinonStub;
  let importedRoutes: sinon.SinonStub;
  let storedObjects: sinon.SinonStub;
  let objectBuffer: sinon.SinonStub;
  let storeCoordinates: sinon.SinonStub;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    walks = sandbox.stub(walkGpxRecords, "walksWithGpxFiles").resolves([]);
    importedRoutes = sandbox.stub(walkGpxRecords, "importedRoutesWithGpxFiles").resolves([]);
    storedObjects = sandbox.stub(awsControllers, "objectsWithPrefix").resolves([]);
    objectBuffer = sandbox.stub(awsControllers, "objectBufferForKey").rejects(new Error("not stubbed for this key"));
    storeCoordinates = sandbox.stub(walkGpxRecords, "storeWalkGpxCoordinates").resolves();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("lists a GPX file in S3 that no walk or imported route refers to, dated from S3", async () => {
    storedObjects.resolves([
      {key: `${RootFolder.gpxRoutes}/${UUID_FILE}`, lastModified: 1700000000000, size: 10},
      {key: `${RootFolder.gpxRoutes}/notes.txt`, lastModified: 1700000000000, size: 10}
    ]);

    const list = await walkGpxFileList();

    expect(list).toEqual([{
      fileData: {rootFolder: RootFolder.gpxRoutes, originalFileName: UUID_FILE, awsFileName: UUID_FILE, title: ""},
      startLat: 0,
      startLng: 0,
      name: UUID_FILE,
      uploadDate: 1700000000000
    }]);
    expect(objectBuffer.called).toEqual(false);
  });

  it("dates a walk's GPX file from S3 and keeps the walk's stored coordinates without reading the file", async () => {
    walks.resolves([walkWith({awsFileName: UUID_FILE, originalFileName: UUID_FILE, startLat: 51.1, startLng: 0.9})]);
    storedObjects.resolves([{key: `${RootFolder.gpxRoutes}/${UUID_FILE}`, lastModified: 1700000000000, size: 10}]);

    const list = await walkGpxFileList();

    expect(list.length).toEqual(1);
    expect(list[0].uploadDate).toEqual(1700000000000);
    expect(list[0].walkTitle).toEqual("Chilham circular");
    expect(list[0].startLat).toEqual(51.1);
    expect(list[0].startLng).toEqual(0.9);
    expect(objectBuffer.called).toEqual(false);
    expect(storeCoordinates.called).toEqual(false);
  });

  it("parses a walk's GPX file once when it has no stored coordinates, and writes them back", async () => {
    walks.resolves([
      walkWith({awsFileName: "chilham.gpx", originalFileName: "chilham.gpx"}),
      walkWith({awsFileName: "chilham.gpx", originalFileName: "chilham.gpx"})
    ]);
    objectBuffer.withArgs(`${RootFolder.gpxRoutes}/chilham.gpx`).resolves(Buffer.from(CHILHAM_GPX, "utf8"));

    const list = await walkGpxFileList();

    expect(list.map(item => [item.startLat, item.startLng])).toEqual([[51.2432, 0.9613]]);
    expect(objectBuffer.callCount).toEqual(1);
    expect(storeCoordinates.callCount).toEqual(1);
    expect(storeCoordinates.firstCall.args).toEqual(["chilham.gpx", {startLat: 51.2432, startLng: 0.9613}]);
  });

  it("falls back to the walk's start location when the GPX file has no points, without writing anything back", async () => {
    walks.resolves([walkWith({awsFileName: "empty.gpx", originalFileName: "empty.gpx"}, {latitude: 51.28, longitude: 1.08})]);
    objectBuffer.withArgs(`${RootFolder.gpxRoutes}/empty.gpx`).resolves(Buffer.from(EMPTY_GPX, "utf8"));

    const list = await walkGpxFileList();

    expect(list[0].startLat).toEqual(51.28);
    expect(list[0].startLng).toEqual(1.08);
    expect(storeCoordinates.called).toEqual(false);
  });

  it("shows an imported route with its own coordinates and import date, and lets a walk take over the same file", async () => {
    importedRoutes.resolves([
      {routeId: "1", url: "https://explore.osmaps.com/route/1", importedAt: 1690000000000, gpxFile: {awsFileName: "imported.gpx", originalFileName: "Stour Valley.gpx", title: "Stour Valley", startLat: 51.3, startLng: 1.1}},
      {routeId: "2", url: "https://explore.osmaps.com/route/2", importedAt: 1690000000000, gpxFile: {awsFileName: "shared.gpx", originalFileName: "shared.gpx", startLat: 51.4, startLng: 1.2}}
    ]);
    walks.resolves([walkWith({awsFileName: "shared.gpx", originalFileName: "shared.gpx", startLat: 51.5, startLng: 1.3})]);

    const list = await walkGpxFileList();

    expect(list.map(item => item.fileData.awsFileName)).toEqual(["imported.gpx", "shared.gpx"]);
    expect(list[0]).toEqual({
      fileData: {rootFolder: RootFolder.gpxRoutes, originalFileName: "Stour Valley.gpx", awsFileName: "imported.gpx", title: "Stour Valley"},
      startLat: 51.3,
      startLng: 1.1,
      name: "Stour Valley.gpx",
      uploadDate: 1690000000000
    });
    expect(list[1].walkTitle).toEqual("Chilham circular");
    expect(list[1].startLat).toEqual(51.5);
  });
});
