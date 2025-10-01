import { inject, Injectable } from "@angular/core";
import * as L from "leaflet";
import "proj4leaflet";
import proj4 from "proj4";
import { SystemConfigService } from "../system/system-config.service";

@Injectable({ providedIn: "root" })
export class MapTilesService {
  private systemConfig = inject(SystemConfigService);
  private projInitialized = false;

  private static readonly EPSG_27700_PROJ4_DEF = "+proj=tmerc +lat_0=49 +lon_0=-2 +k=0.9996012717 +x_0=400000 +y_0=-100000 +ellps=airy +towgs84=-446.448,125.157,-542.06,-0.1502,-0.2470,-0.8421,20.4894 +units=m +no_defs";
  private static readonly EPSG_27700_CRS_OPTIONS = {
    resolutions: [896, 448, 224, 112, 56, 28, 14, 7, 3.5, 1.75],
    origin: [-238375.0, 1376256.0],
    bounds: L.bounds([-238375.0, 0.0], [900000.0, 1376256.0])
  };

  hasOsApiKey(): boolean {
    return !!this.osApiKey();
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
      const apiKey = this.osApiKey();
      if (!apiKey) {
        return L.tileLayer(this.osmUrl(), { attribution: "© OpenStreetMap (OS Maps unavailable)", maxZoom: 19, noWrap: true });
      }
      const url = this.osZxyUrl(style, apiKey);
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

  private osZxyUrl(layer: string, key: string): string {
    return `https://api.os.uk/maps/raster/v1/zxy/${layer}/{z}/{x}/{y}.png?key=${key || ""}`;
  }

  private osmUrl(): string {
    return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  }

  private osApiKey(): string {
    const cfg: any = this.systemConfig.systemConfig();
    const keyFromConfig = cfg?.externalSystems?.osMaps?.apiKey || cfg?.externalSystems?.os_maps?.apiKey || cfg?.osMaps?.apiKey;
    return keyFromConfig || "";
  }
}
