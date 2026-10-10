import { TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { SimpleChange } from "@angular/core";
import { OsMapsListedRoute } from "../../../models/os-maps-export.model";
import { GpxParserService } from "../../../services/maps/gpx-parser.service";
import { MapTilesService } from "../../../services/maps/map-tiles.service";
import { MapZoomService } from "../../../services/maps/map-zoom.service";
import { RouteFollowCacheService } from "../../../services/maps/route-follow-cache.service";
import { RouteFollowPayloadService } from "../../../services/maps/route-follow-payload.service";
import { OsMapsRoutePreviewMapComponent } from "./os-maps-route-preview-map";

describe("lazy route thumbnail detail", () => {
  const points = [...new Array(200)].map((value, index) => ({latitude: 51 + index / 100000, longitude: index / 100000, breakBefore: index === 100}));
  const cache = {payload: vi.fn().mockResolvedValue({points})};

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [LoggerTestingModule],
      providers: [provideHttpClient(), provideHttpClientTesting(),
        {provide: GpxParserService, useValue: {parseGpxFile: () => ({tracks: [{points}]})}},
        {provide: RouteFollowPayloadService, useValue: {gpxDownloadUrl: () => "/api/routes/fictional-preview.gpx"}},
        {provide: RouteFollowCacheService, useValue: cache},
        {provide: MapTilesService, useValue: {}},
        {provide: MapZoomService, useValue: {}}]
    });
    cache.payload.mockClear();
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it("defers the GPX until visible, replaces a sparse sketch with all points and retains them when scrolling back", async () => {
    const preview = TestBed.runInInjectionContext(() => new OsMapsRoutePreviewMapComponent());
    preview.route = {id: "fictional-preview", gpxFile: {awsFileName: "fictional-preview.gpx"}} as OsMapsListedRoute;
    preview.points = [points[0], points[100], points[199]];
    const map = vi.spyOn(preview as unknown as {ensureMap: () => void}, "ensureMap").mockImplementation(() => null);
    vi.spyOn(preview as unknown as {drawIfReady: () => void}, "drawIfReady").mockImplementation(() => null);
    const http = TestBed.inject(HttpTestingController);
    preview.ngOnChanges({route: new SimpleChange(null, preview.route, true)});
    http.expectNone("/api/routes/fictional-preview.gpx");
    expect(map).not.toHaveBeenCalled();
    preview.onVisibilityChange(true);
    const request = http.expectOne("/api/routes/fictional-preview.gpx");
    preview.points = [points[0], points[199]];
    preview.ngOnChanges({points: new SimpleChange(null, preview.points, false)});
    http.expectNone("/api/routes/fictional-preview.gpx");
    request.flush("fictional-gpx");
    await Promise.resolve();
    await Promise.resolve();
    expect(preview["latLngs"]).toHaveLength(200);
    expect(preview["previewPoints"][100].breakBefore).toBe(true);
    preview.onVisibilityChange(false);
    preview.onVisibilityChange(true);
    http.expectNone("/api/routes/fictional-preview.gpx");
    expect(preview["latLngs"]).toHaveLength(200);
    preview.ngOnDestroy();
  });

  it("reads full cached geometry only when a locally saved thumbnail becomes visible", async () => {
    const preview = TestBed.runInInjectionContext(() => new OsMapsRoutePreviewMapComponent());
    preview.cacheKey = "recording:fictional-cached-preview";
    preview.points = [points[0], points[199]];
    vi.spyOn(preview as unknown as {ensureMap: () => void}, "ensureMap").mockImplementation(() => null);
    vi.spyOn(preview as unknown as {drawIfReady: () => void}, "drawIfReady").mockImplementation(() => null);
    expect(cache.payload).not.toHaveBeenCalled();
    preview.onVisibilityChange(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(cache.payload).toHaveBeenCalledWith("recording:fictional-cached-preview");
    expect(preview["latLngs"]).toHaveLength(200);
    preview.ngOnDestroy();
  });
});
