import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { of } from "rxjs";
import { LoggerTestingModule } from "ngx-logger/testing";
import { RouteFollowSource } from "../../models/route-follow.model";
import { DateUtilsService } from "../date-utils.service";
import { PageContentService } from "../page-content.service";
import { WalksAndEventsService } from "../walks-and-events/walks-and-events.service";
import { WalkGpxService } from "../walks/walk-gpx.service";
import { UrlService } from "../url.service";
import { RouteFollowPayloadService } from "./route-follow-payload.service";
import { RouteFollowSaveService } from "./route-follow-save.service";
import { OsMapsExportService } from "./os-maps-export.service";

describe("RouteFollowSaveService", () => {
  let service: RouteFollowSaveService;
  const savedWalks: {fields?: {routeColor?: string; routeWeight?: number; routeOpacity?: number}}[] = [];
  const walksAndEvents = {
    queryById: async () => ({id: "walk-1", fields: {}, groupEvent: {title: "Walk"}}),
    createOrUpdate: async (walk: {fields?: {routeColor?: string; routeWeight?: number; routeOpacity?: number}}) => {
      savedWalks.push(walk);
      return walk;
    }
  };
  const walkGpx = {
    importGpxFile: vi.fn(() => of({
      gpxFile: {
        awsFileName: "saved.gpx",
        originalFileName: "route-20261010-115403.gpx",
        title: "route-20261010-115403",
        distanceMetres: 125
      },
      routeId: "recording-fictional-id",
      number: 396
    })),
    uploadGpxFile: vi.fn(() => of({gpxFile: {awsFileName: "gpx-routes/saved.gpx", originalFileName: "route-20261010-115403.gpx", title: "route-20261010-115403"}}))
  };
  const savedImported: {gpxFile?: {title?: string}}[] = [];
  const osMapsExport = {
    saveImportedRoute: vi.fn(async (_routeId: string, update: {gpxFile?: {title?: string}}) => {
      savedImported.push(update);
      return {};
    })
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        RouteFollowSaveService,
        RouteFollowPayloadService,
        DateUtilsService,
        {provide: WalksAndEventsService, useValue: walksAndEvents},
        {provide: WalkGpxService, useValue: walkGpx},
        {provide: PageContentService, useValue: {findByPath: async () => null, createOrUpdate: async (page: unknown) => page}},
        {provide: UrlService, useValue: {
          isRemoteUrl: () => false,
          resourceRelativePathForAWSFileName: (name: string) => `/api/aws/s3/${name}`
        }},
        {provide: OsMapsExportService, useValue: osMapsExport}
      ]
    });
    service = TestBed.inject(RouteFollowSaveService);
  });

  it("keeps the original creator while accepting the new modification audit", () => {
    const saved = service["preserveCreationAudit"](
      {createdDate: 100, createdBy: "creator-id", createdByName: "Alex Reed"},
      {createdDate: 200, createdBy: "editor-id", createdByName: "Sam Field", updatedDate: 200, updatedBy: "editor-id"}
    );
    expect(saved.createdDate).toBe(100);
    expect(saved.createdBy).toBe("creator-id");
    expect(saved.createdByName).toBe("Alex Reed");
    expect(saved.updatedDate).toBe(200);
    expect(saved.updatedBy).toBe("editor-id");
  });

  it("writes a GPX track from the recorded points", () => {
    const gpx = service.pointsToGpx([
      {latitude: 51.2, longitude: 1.0, elevation: 20},
      {latitude: 51.21, longitude: 1.01, elevation: 22}
    ], "Sunday walk");
    expect(gpx).toContain("<trkpt lat=\"51.2\" lon=\"1\">");
    expect(gpx).toContain("<trkpt lat=\"51.21\" lon=\"1.01\">");
    expect(gpx).toContain("<name>Sunday walk</name>");
  });

  it("saves a standalone route through the shared import without changing a walk", async () => {
    const points = [{latitude: 51, longitude: 0}, {latitude: 51.001, longitude: 0.001}];
    const payload = TestBed.inject(RouteFollowPayloadService).recordingPayload("fictional-id");
    payload.title = "Hillside trail";
    payload.description = "A loop through the woods & fields";
    const previousWalkCount = savedWalks.length;
    const saved = await service.saveStandalone(payload, points);
    const args = walkGpx.importGpxFile.mock.calls.at(-1) as unknown as [File, string, string, string];
    expect(args.slice(1)).toEqual([payload.title, payload.description, "fictional-id"]);
    expect(service.pointsToGpx(points, payload.title, payload.description)).toContain("<desc>A loop through the woods &amp; fields</desc>");
    expect(saved.source).toBe(RouteFollowSource.OS_MAPS);
    expect(saved.recordingId).toBeNull();
    expect(saved.osMapsRouteId).toBe("recording-fictional-id");
    expect(saved.title).toBe("Hillside trail");
    expect(saved.description).toBe("A loop through the woods & fields");
    expect(saved.routeNumber).toBe(396);
    expect(saved.totalMetres).toBe(125);
    expect(savedWalks.length).toBe(previousWalkCount);
    expect(payload.source).toBe(RouteFollowSource.RECORDING);
  });

  it("rejects unnamed recordings before upload", async () => {
    const payload = TestBed.inject(RouteFollowPayloadService).recordingPayload("fictional-id");
    payload.title = " ";
    const imports = walkGpx.importGpxFile.mock.calls.length;
    await expect(service.saveStandalone(payload, [{latitude: 51, longitude: 0}, {latitude: 51.001, longitude: 0.001}])).rejects.toThrow("Give the recording a name");
    expect(walkGpx.importGpxFile.mock.calls.length).toBe(imports);
  });

  it("saves a walk line by uploading GPX and attaching it", async () => {
    const file = await service.save({
      source: RouteFollowSource.WALK,
      title: "Sunday walk",
      path: null,
      walkId: "sunday-walk",
      routeId: null,
      ramblersSlug: null,
      osMapsRouteId: null,
      provider: "os",
      osStyle: "Leisure_27700",
      color: "#c21d4b",
      weight: 8,
      opacity: 1,
      points: [],
      waypoints: [],
      totalMetres: 0,
      guide: null
    }, [
      {latitude: 51.2, longitude: 1.0},
      {latitude: 51.21, longitude: 1.01}
    ]);
    expect(file.awsFileName).toBe("gpx-routes/saved.gpx");
    expect(savedWalks[savedWalks.length - 1].fields.routeColor).toBe("#c21d4b");
  });

  it("saves a walk route style without uploading a new line", async () => {
    await service.saveStyle({
      source: RouteFollowSource.WALK,
      title: "Sunday walk",
      path: null,
      walkId: "sunday-walk",
      routeId: null,
      ramblersSlug: null,
      osMapsRouteId: null,
      provider: "os",
      osStyle: "Leisure_27700",
      color: "#4c6c3e",
      weight: 6,
      opacity: 0.8,
      points: [],
      waypoints: [],
      totalMetres: 0,
      guide: null
    });
    expect(savedWalks[savedWalks.length - 1].fields.routeColor).toBe("#4c6c3e");
    expect(savedWalks[savedWalks.length - 1].fields.routeWeight).toBe(6);
    expect(savedWalks[savedWalks.length - 1].fields.routeOpacity).toBe(0.8);
  });

  it("keeps the route name when replacing an imported GPX after an edit", async () => {
    await service.save({
      source: RouteFollowSource.OS_MAPS,
      title: "Hillside trail",
      description: "A loop through the woods",
      path: null,
      walkId: null,
      routeId: null,
      ramblersSlug: null,
      osMapsRouteId: "recording-fictional-id",
      provider: "os",
      osStyle: "Leisure_27700",
      color: "#c21d4b",
      weight: 8,
      opacity: 1,
      points: [],
      waypoints: [],
      totalMetres: 0,
      guide: null
    }, [
      {latitude: 51.2, longitude: 1.0},
      {latitude: 51.21, longitude: 1.01}
    ]);
    const uploadArgs = walkGpx.uploadGpxFile.mock.calls.at(-1) as unknown as [File, string];
    expect(uploadArgs[1]).toBe("Hillside trail");
    expect(savedImported[savedImported.length - 1].gpxFile?.title).toBe("Hillside trail");
  });
});
