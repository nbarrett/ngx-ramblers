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

    expect(layer.getAttribution()).toContain("Ordnance Survey");
  });
});
