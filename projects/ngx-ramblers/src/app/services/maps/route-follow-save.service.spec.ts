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
    uploadGpxFile: () => of({gpxFile: {awsFileName: "gpx-routes/saved.gpx", originalFileName: "saved.gpx"}})
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
        {provide: OsMapsExportService, useValue: {saveImportedRoute: async () => ({})}}
      ]
    });
    service = TestBed.inject(RouteFollowSaveService);
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
});
