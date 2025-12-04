import { inject, Injectable } from "@angular/core";
import * as L from "leaflet";
import "proj4leaflet";
import proj4 from "proj4";
import { SystemConfigService } from "../system/system-config.service";
import { PageContent, PageContentRow, PageContentType } from "../../models/content-text.model";
import { LoggerFactory } from "../logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Injectable({ providedIn: "root" })
export class MapTilesService {
  private static readonly EPSG_27700_PROJ4_DEF = "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=-446.448,125.157,-542.06,-0.1502,-0.2470,-0.8421,20.4894 +units=m +no_defs";
  private static readonly EPSG_27700_CRS_OPTIONS = {
    resolutions: [896, 448, 224, 112, 56, 28, 14, 7, 3.5, 1.75],
    origin: [-238375.0, 1376256.0],
    bounds: L.bounds([-238375.0, 0.0], [900000.0, 1376256.0])
  };

  private systemConfig = inject(SystemConfigService);
  private projInitialized = false;
  private logger = inject(LoggerFactory).createLogger("MapTilesService", NgxLoggerLevel.INFO);

  hasOsApiKey(): boolean {
    return this.osApiKeyConfigured();
  }

  initializeProjections(): void {
    if (this.projInitialized) return;

    const projNS: any = (L as any).Proj;
    if (projNS?.setProj4) {
      projNS.setProj4(proj4);
    }
    if ((proj4 as any).defs && !(proj4 as any).defs["EPSG:27700"]) {
      (proj4 as any).defs("EPSG:27700", MapTilesService.EPSG_27700_PROJ4_DEF);
    }

    this.projInitialized = true;
  }

  createBaseLayer(provider: "osm" | "os", style: string): L.TileLayer {
    this.initializeProjections();

    if (provider === "os") {
      if (!this.osApiKeyConfigured()) {
        return L.tileLayer(this.osmUrl(), { attribution: "© OpenStreetMap (OS Maps unavailable)", maxZoom: 19, noWrap: true });
      }

      const url = this.osProxyUrl(style);

      if (style.endsWith("27700") && (L as any).Proj?.TileLayer) {
        return new (L as any).Proj.TileLayer(url, { attribution: "© Ordnance Survey", continuousWorld: true, noWrap: true, maxZoom: 9 });
      }
      return L.tileLayer(url, { attribution: "© Ordnance Survey", maxZoom: 19, noWrap: true });
    }
    return L.tileLayer(this.osmUrl(), { attribution: "© OpenStreetMap", maxZoom: 19, noWrap: true });
  }

  crsForStyle(provider: "osm" | "os", style: string): any {
    this.initializeProjections();
    if (provider === "os" && style.endsWith("27700")) {
      const crsCtor = (L as any).Proj?.CRS;
      if (crsCtor) {
        return new crsCtor("EPSG:27700", MapTilesService.EPSG_27700_PROJ4_DEF, MapTilesService.EPSG_27700_CRS_OPTIONS);
      }
    }
    return L.CRS.EPSG3857;
  }

  maxZoomForStyle(provider: "osm" | "os", style: string): number {
    if (provider === "os" && style.endsWith("27700")) {
      return 9;
    }
    return 19;
  }

  private osProxyUrl(layer: string): string {
    return `/api/os-maps/tiles/${layer}/{z}/{x}/{y}.png`;
  }

  private osmUrl(): string {
    return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  }

  private osApiKeyConfigured(): boolean {
    const cfg: any = this.systemConfig.systemConfig();
    return !!(cfg?.externalSystems?.osMaps);
  }

  syncMarkersFromLocation(pageContent: PageContent, row: PageContentRow) {
    if (!row.map) {
      this.logger.info("syncMarkersFromLocation: no map");
    } else {
      const locationRow: PageContentRow = pageContent?.rows?.find(row => row.type === PageContentType.LOCATION && row.location);
      if (!locationRow?.location) {
        this.logger.info("syncMarkersFromLocation: no location row found in pageContent rows:", pageContent?.rows);
      } else {
        const hasStartLocation = locationRow.location.start?.latitude != null && locationRow.location.start?.longitude != null;
        const hasEndLocation = locationRow.location.end?.latitude != null && locationRow.location.end?.longitude != null;
        if (!hasStartLocation && !hasEndLocation) {
          this.logger.info("syncMarkersFromLocation: no start or end location found in location:", locationRow.location);
        } else {
          this.logger.info("syncMarkersFromLocation: sufficient data to initialise markers map:", row.map, "from pageContent rows:", pageContent?.rows);
          const currentMarkers = row.map.markers || [];
          const hasMatchingMarkers = currentMarkers.some(m =>
            (hasStartLocation && m.latitude === locationRow.location.start.latitude && m.longitude === locationRow.location.start.longitude) ||
            (hasEndLocation && m.latitude === locationRow.location.end?.latitude && m.longitude === locationRow.location.end?.longitude)
          );
          if (hasMatchingMarkers) {
            this.logger.info("syncMarkersFromLocation: Markers already synced with location row");
          } else {
            this.logger.info("syncMarkersFromLocation: Auto-syncing markers from location row");
            row.map.markers = [];
            if (hasStartLocation) {
              row.map.markers.push({
                latitude: locationRow.location.start.latitude,
                longitude: locationRow.location.start.longitude,
                label: locationRow.location.start.description || "Start"
              });
            }
            if (hasEndLocation) {
              row.map.markers.push({
                latitude: locationRow.location.end.latitude,
                longitude: locationRow.location.end.longitude,
                label: locationRow.location.end.description || "End"
              });
            }
            if (hasStartLocation) {
              row.map.mapCenter = [locationRow.location.start.latitude, locationRow.location.start.longitude];
              if (!row.map.mapZoom || row.map.mapZoom < 10) {
                row.map.mapZoom = 14;
              }
            }
            this.logger.info("syncMarkersFromLocation: Auto-synced markers:", row.map.markers, "centered at:", row.map.mapCenter);
          }
        }
      }
    }
  }
}
