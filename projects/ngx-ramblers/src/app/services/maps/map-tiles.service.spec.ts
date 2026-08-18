import { TestBed } from "@angular/core/testing";
import { LoggerTestingModule } from "ngx-logger/testing";
import { MapTilesService } from "./map-tiles.service";
import { SystemConfigService } from "../system/system-config.service";
import { DEFAULT_OS_STYLE, MapProvider, OSMapStyle } from "../../models/map.model";
import { MapProjectionCode } from "../../common/maps/map-projection.constants";

describe("MapTilesService", () => {
  beforeEach(() => TestBed.configureTestingModule({
    imports: [LoggerTestingModule],
    providers: [
      MapTilesService,
      {
        provide: SystemConfigService,
        useValue: {
          systemConfig: () => ({ externalSystems: { osMaps: { apiKey: "test-key" } } })
        }
      }
    ]
  }));

  it("returns a projected CRS for OS 27700 styles", () => {
    const service = TestBed.inject(MapTilesService);
    const crs: any = service.crsForStyle(MapProvider.OS, OSMapStyle.LEISURE_27700.key);

    expect(crs?.code).toBe(MapProjectionCode.BRITISH_NATIONAL_GRID);
  });

  it("returns web mercator CRS for OS 3857 styles", () => {
    const service = TestBed.inject(MapTilesService);
    const crs: any = service.crsForStyle(MapProvider.OS, "Light_3857");

    expect(crs).toBeDefined();
    expect(crs?.code).not.toBe(MapProjectionCode.BRITISH_NATIONAL_GRID);
  });

  it("creates an OS tile layer for 27700 styles without falling back to OSM", () => {
    const service = TestBed.inject(MapTilesService);
    const layer = service.createBaseLayer(MapProvider.OS, DEFAULT_OS_STYLE);

    expect(layer.getAttribution()).toContain("Contains OS data");
    expect(layer.getAttribution()).toContain("Crown copyright");
    expect(layer.getAttribution()).toContain("osdatahub.os.uk/legal/apiTermsConditions");
  });

  it("lets OS Explorer overzoom two levels past its native tiles", () => {
    const service = TestBed.inject(MapTilesService);
    const layer = service.createBaseLayer(MapProvider.OS, OSMapStyle.LEISURE_27700.key);

    expect(layer.options.maxNativeZoom).toBe(9);
    expect(layer.options.maxZoom).toBe(11);
  });

  it("exposes OS Outdoor native zooms through 13", () => {
    const service = TestBed.inject(MapTilesService);
    const layer = service.createBaseLayer(MapProvider.OS, OSMapStyle.OUTDOOR_27700.key);

    expect(layer.options.maxNativeZoom).toBe(13);
    expect(layer.options.maxZoom).toBe(13);
  });

  it("keeps the same OS zoom when only the OS style changes", () => {
    const service = TestBed.inject(MapTilesService);
    const zoom = service.matchingZoom(
      MapProvider.OS, OSMapStyle.LEISURE_27700.key, 7,
      MapProvider.OS, OSMapStyle.OUTDOOR_27700.key, 51.2
    );
    expect(zoom).toBe(7);
  });

  it("prefetches only the native OS zoom for a route corridor", () => {
    const service = TestBed.inject(MapTilesService);
    const urls = service.tileUrlsForPoints(MapProvider.OS, OSMapStyle.LEISURE_27700.key, [
      {latitude: 51.28, longitude: 1.08},
      {latitude: 51.29, longitude: 1.09}
    ]);
    const zooms = urls.map(url => url.match(/\/(\d+)\/\d+\/\d+\.png$/)?.[1]);
    expect(urls.length).toBeGreaterThan(0);
    expect(new Set(zooms).size).toBe(1);
    expect(zooms[0]).toBe("9");
  });

  it("picks an OSM zoom that matches OS Explorer scale at UK latitudes", () => {
    const service = TestBed.inject(MapTilesService);
    const osm = service.matchingZoom(
      MapProvider.OS, OSMapStyle.LEISURE_27700.key, 7,
      MapProvider.OSM, OSMapStyle.LEISURE_27700.key, 51.2
    );
    expect(osm).toBe(14);
    const back = service.matchingZoom(
      MapProvider.OSM, OSMapStyle.LEISURE_27700.key, osm,
      MapProvider.OS, OSMapStyle.LEISURE_27700.key, 51.2
    );
    expect(back).toBe(7);
  });
});
