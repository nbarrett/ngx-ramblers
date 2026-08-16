import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { PageContent, PageContentType } from "../../models/content-text.model";
import { ExtendedGroupEvent, InputSource } from "../../models/group-event.model";
import { RouteFollowSource } from "../../models/route-follow.model";
import { RouteFollowPayloadService } from "./route-follow-payload.service";
import { UrlService } from "../url.service";

describe("RouteFollowPayloadService", () => {
  let service: RouteFollowPayloadService;

  const pageWithRoute: PageContent = {
    path: "walks/routes/recommended/barham-and-four-churches-walk",
    rows: [
      {
        type: PageContentType.TEXT,
        showSwiper: false,
        columns: []
      },
      {
        type: PageContentType.MAP,
        showSwiper: false,
        columns: [],
        map: {
          routes: [
            {
              id: "route-1",
              name: "Barham and Four Churches",
              visible: true,
              gpxFile: {awsFileName: "gpx-routes/barham.gpx"}
            }
          ],
          markers: [
            {latitude: 51.2, longitude: 1.16, label: "1", instruction: "Start at the village hall"}
          ]
        }
      }
    ]
  } as PageContent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        RouteFollowPayloadService,
        {provide: UrlService, useValue: {
          isRemoteUrl: () => false,
          resourceRelativePathForAWSFileName: (name: string) => `/api/aws/s3/${name}`
        }}
      ]
    });
    service = TestBed.inject(RouteFollowPayloadService);
  });

  it("finds a followable map row on a page", () => {
    const row = service.followableRow(pageWithRoute);
    expect(row).toBeTruthy();
    expect(service.rowHasGpx(row)).toBe(true);
  });

  it("returns summaries for pages that have a GPX route", () => {
    const summaries = service.summariesFromPages([pageWithRoute]);
    expect(summaries.length).toBe(1);
    expect(summaries[0].source).toBe(RouteFollowSource.PAGE);
    expect(summaries[0].path).toBe("walks/routes/recommended/barham-and-four-churches-walk");
    expect(summaries[0].routeId).toBe("route-1");
  });

  it("returns a walk summary only when the walk has a GPX file", () => {
    const withGpx = {
      id: "walk-1",
      fields: {gpxFile: {awsFileName: "gpx-routes/walk.gpx"}, inputSource: InputSource.MANUALLY_CREATED},
      groupEvent: {title: "Saturday walk", distance_miles: 6}
    } as unknown as ExtendedGroupEvent;
    const withoutGpx = {
      id: "walk-2",
      fields: {inputSource: InputSource.MANUALLY_CREATED},
      groupEvent: {title: "No route"}
    } as unknown as ExtendedGroupEvent;
    expect(service.summaryFromWalk(withGpx)).toBeTruthy();
    expect(service.summaryFromWalk(withoutGpx)).toBeNull();
  });

  it("builds a walk payload from a start location when there is no GPX", async () => {
    const walk = {
      id: "walk-3",
      fields: {inputSource: InputSource.MANUALLY_CREATED},
      groupEvent: {
        title: "Sunday walk",
        start_location: {latitude: 51.2, longitude: 1.16, description: "Village hall"}
      }
    } as unknown as ExtendedGroupEvent;
    const payload = await service.payloadFromWalk(walk);
    expect(payload).toBeTruthy();
    expect(payload.points.length).toBe(0);
    expect(payload.waypoints[0].latitude).toBe(51.2);
    expect(payload.waypoints[0].instruction).toBe("Village hall");
    expect(payload.color).toBe("#c21d4b");
  });

  it("uses the walk route colour when one is stored", async () => {
    const walk = {
      id: "walk-4",
      fields: {inputSource: InputSource.MANUALLY_CREATED, routeColor: "#2e54a6"},
      groupEvent: {
        title: "Blue line",
        start_location: {latitude: 51.2, longitude: 1.16, description: "Village hall"}
      }
    } as unknown as ExtendedGroupEvent;
    const payload = await service.payloadFromWalk(walk);
    expect(payload.color).toBe("#2e54a6");
  });

  it("builds a follow payload from a Ramblers library route", () => {
    const payload = service.payloadFromLibraryRoute({
      slug: "egerton-kent",
      title: "Egerton, Kent",
      description: "Circular walk",
      startDescription: "Village green",
      startLatitude: 51.195,
      startLongitude: 0.729,
      distanceMiles: 8.3,
      durationMinutes: 240,
      difficulty: "Moderate",
      shape: "circular",
      sourceUrl: "https://www.ramblers.org.uk/go-walking/routes/egerton-kent",
      points: [],
      waypoints: [{id: "s", latitude: 51.195, longitude: 0.729, label: "Start"}],
      hasLine: false
    });
    expect(payload.title).toBe("Egerton, Kent");
    expect(payload.source).toBe(RouteFollowSource.RAMBLERS_LIBRARY);
    expect(payload.waypoints[0].label).toBe("Start");
  });

  it("builds a waypoint from an authored marker", () => {
    const waypoint = service.waypointFromMarker({
      latitude: 51.2,
      longitude: 1.16,
      label: "1",
      instruction: "Start at the village hall"
    }, 0);
    expect(waypoint.label).toBe("1");
    expect(waypoint.instruction).toBe("Start at the village hall");
    expect(waypoint.id).toBeTruthy();
  });
});
