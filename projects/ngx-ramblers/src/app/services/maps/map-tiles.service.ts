import { inject, Injectable } from "@angular/core";
import * as L from "leaflet";
import "proj4leaflet";
import proj4 from "proj4";
import * as proj4leaflet from "proj4leaflet";
import { SystemConfigService } from "../system/system-config.service";
import { OsMapsBrandingService } from "./os-maps-branding.service";
import { MapMarker, PageContent, PageContentRow, PageContentType } from "../../models/content-text.model";
import { markersSyncedWithLocation, pageLocation } from "../../functions/map-location-markers";
import { MapProvider, OSMapStyle, osStyleForKey } from "../../models/map.model";
import { LoggerFactory } from "../logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import {
  EPSG_27700_LEISURE_MAX_ZOOM,
  EPSG_27700_LEISURE_NATIVE_ZOOM,
  EPSG_27700_NATIVE_ZOOM,
  EPSG_27700_PROJ4,
  EPSG_27700_RESOLUTIONS,
  MapProjectionCode,
  WEB_MERCATOR_METRES_PER_PIXEL_AT_ZOOM_0
} from "../../common/maps/map-projection.constants";
import { Proj4LeafletApi } from "../../models/proj4leaflet.model";
import { installLeafletMapGestures } from "./map-gestures";

installLeafletMapGestures();

@Injectable({ providedIn: "root" })
export class MapTilesService {
  private static readonly EPSG_27700_CRS_OPTIONS = {
    resolutions: EPSG_27700_RESOLUTIONS,
    origin: [-238375.0, 1376256.0] as [number, number],
    bounds: L.bounds([-238375.0, 0.0], [900000.0, 1376256.0])
  };

  private systemConfig = inject(SystemConfigService);
  private osBranding = inject(OsMapsBrandingService);
  private projInitialized = false;
  private logger = inject(LoggerFactory).createLogger("MapTilesService", NgxLoggerLevel.ERROR);
  private leafletProj: Proj4LeafletApi = proj4leaflet as Proj4LeafletApi;

  hasOsApiKey(): boolean {
    return this.osApiKeyConfigured();
  }

  initializeProjections(): void {
    if (this.projInitialized) return;

    const projNS = this.leafletProj;
    if (projNS?.setProj4) {
      projNS.setProj4(proj4);
    }
    if ((proj4 as any).defs && !(proj4 as any).defs[MapProjectionCode.BRITISH_NATIONAL_GRID]) {
      (proj4 as any).defs(MapProjectionCode.BRITISH_NATIONAL_GRID, EPSG_27700_PROJ4);
    }

    this.projInitialized = true;
  }

  createBaseLayer(provider: MapProvider, style: string): L.TileLayer {
    this.initializeProjections();
    const maxZoom = this.maxZoomForStyle(provider, style);
    const options: L.TileLayerOptions = {
      noWrap: true,
      maxZoom,
      maxNativeZoom: this.nativeMaxZoomForStyle(provider, style)
    };
    if (provider === MapProvider.OS) {
      if (!this.osApiKeyConfigured()) {
        return this.withBranding(this.withTileRetry(L.tileLayer(this.osmUrl(), {
          ...options,
          attribution: "© OpenStreetMap (OS Maps unavailable)",
          maxZoom: 19,
          maxNativeZoom: 19
        })), false);
      } else {
        return this.withBranding(this.withTileRetry(L.tileLayer(this.osProxyUrl(style), {
          ...options,
          attribution: this.osBranding.attributionHtml()
        })), true);
      }
    } else {
      return this.withBranding(this.withTileRetry(L.tileLayer(this.osmUrl(), {
        ...options,
        attribution: "© OpenStreetMap"
      })), false);
    }
  }

  crsForStyle(provider: MapProvider, style: string): any {
    this.initializeProjections();
    const styleInfo = osStyleForKey(style);
    if (provider === MapProvider.OS && styleInfo?.is27700) {
      const crsCtor = this.leafletProj?.CRS;
      if (crsCtor) {
        return new crsCtor(MapProjectionCode.BRITISH_NATIONAL_GRID, EPSG_27700_PROJ4, MapTilesService.EPSG_27700_CRS_OPTIONS);
      }
    }
    return L.CRS.EPSG3857;
  }

  tileUrlsForPoints(provider: MapProvider, style: string, points: {latitude: number; longitude: number}[]): string[] {
    this.initializeProjections();
    if (points.length === 0) {
      return [];
    } else {
      const crs = this.crsForStyle(provider, style);
      const maxZoom = this.nativeMaxZoomForStyle(provider, style);
      const minZoom = provider === MapProvider.OS ? maxZoom : Math.max(maxZoom - 5, 11);
      const lats = points.map(point => point.latitude);
      const lngs = points.map(point => point.longitude);
      const south = Math.min(...lats);
      const north = Math.max(...lats);
      const west = Math.min(...lngs);
      const east = Math.max(...lngs);
      const padLat = Math.max((north - south) * 0.2, 0.01);
      const padLng = Math.max((east - west) * 0.2, 0.01);
      const zooms = Array.from({length: maxZoom - minZoom + 1}, (_, index) => minZoom + index);
      const template = provider === MapProvider.OS && this.osApiKeyConfigured()
        ? this.osProxyUrl(style)
        : this.osmUrl();
      return zooms.reduce((acc: string[], zoom) => {
        const nw = crs.latLngToPoint(L.latLng(north + padLat, west - padLng), zoom);
        const se = crs.latLngToPoint(L.latLng(south - padLat, east + padLng), zoom);
        const minX = Math.floor(Math.min(nw.x, se.x) / 256);
        const maxX = Math.floor(Math.max(nw.x, se.x) / 256);
        const minY = Math.floor(Math.min(nw.y, se.y) / 256);
        const maxY = Math.floor(Math.max(nw.y, se.y) / 256);
        const xs = Array.from({length: maxX - minX + 1}, (_, index) => minX + index);
        const ys = Array.from({length: maxY - minY + 1}, (_, index) => minY + index);
        const urls = xs.reduce((row: string[], x) => {
          return [...row, ...ys.map(y => template.replace("{s}", "a").replace("{z}", String(zoom)).replace("{x}", String(x)).replace("{y}", String(y)))];
        }, []);
        return [...acc, ...urls];
      }, []).slice(0, 500);
    }
  }

  maxZoomForStyle(provider: MapProvider, style: string): number {
    const styleInfo = osStyleForKey(style);
    if (provider === MapProvider.OS && styleInfo?.is27700) {
      if (styleInfo.key === OSMapStyle.LEISURE_27700.key) {
        return EPSG_27700_LEISURE_MAX_ZOOM;
      } else {
        return EPSG_27700_NATIVE_ZOOM;
      }
    } else {
      return 19;
    }
  }

  matchingZoom(
    fromProvider: MapProvider,
    fromStyle: string,
    fromZoom: number,
    toProvider: MapProvider,
    toStyle: string,
    latitude: number
  ): number {
    const target = this.metresPerPixel(fromProvider, fromStyle, fromZoom, latitude);
    const maxZoom = this.maxZoomForStyle(toProvider, toStyle);
    const zooms = Array.from({length: maxZoom + 1}, (_, zoom) => zoom);
    return zooms.reduce((best, zoom) => {
      const resolution = this.metresPerPixel(toProvider, toStyle, zoom, latitude);
      const score = Math.abs(Math.log(resolution) - Math.log(target));
      return score < best.score ? {zoom, score} : best;
    }, {zoom: 0, score: Number.POSITIVE_INFINITY}).zoom;
  }

  metresPerPixel(provider: MapProvider, style: string, zoom: number, latitude: number): number {
    const styleInfo = osStyleForKey(style);
    if (provider === MapProvider.OS && styleInfo?.is27700) {
      return EPSG_27700_RESOLUTIONS[0] / Math.pow(2, zoom);
    } else {
      return WEB_MERCATOR_METRES_PER_PIXEL_AT_ZOOM_0 * Math.cos(latitude * Math.PI / 180) / Math.pow(2, zoom);
    }
  }

  nativeMaxZoomForStyle(provider: MapProvider, style: string): number {
    const styleInfo = osStyleForKey(style);
    if (provider === MapProvider.OS && styleInfo?.is27700) {
      if (styleInfo.key === OSMapStyle.LEISURE_27700.key) {
        return EPSG_27700_LEISURE_NATIVE_ZOOM;
      } else {
        return EPSG_27700_NATIVE_ZOOM;
      }
    } else {
      return 19;
    }
  }

  private static readonly MAX_TILE_RETRIES = 3;

  private withTileRetry(layer: L.TileLayer): L.TileLayer {
    const attempts = new WeakMap<HTMLImageElement, number>();
    layer.on("tileload", (event: L.LeafletEvent) => {
      const tile = (event as L.TileEvent).tile as HTMLImageElement;
      if (tile) {
        attempts.delete(tile);
      }
    });
    layer.on("tileerror", (event: L.LeafletEvent) => {
      const tile = (event as L.TileErrorEvent).tile as HTMLImageElement;
      if (tile) {
        const used = attempts.get(tile) ?? 0;
        if (used < MapTilesService.MAX_TILE_RETRIES) {
          attempts.set(tile, used + 1);
          const baseSrc = this.stripRetryParam(tile.src);
          window.setTimeout(() => {
            if (this.stripRetryParam(tile.src) === baseSrc) {
              const separator = baseSrc.includes("?") ? "&" : "?";
              tile.src = `${baseSrc}${separator}retry=${used + 1}`;
            }
          }, this.tileRetryDelayMs(used));
        }
      }
    });
    return layer;
  }

  private stripRetryParam(src: string): string {
    return src.replace(/[?&]retry=\d+/, "");
  }

  private tileRetryDelayMs(attempt: number): number {
    return 800 * Math.pow(2, attempt) + Math.floor(Math.random() * 400);
  }

  private withBranding(layer: L.TileLayer, showOsLogo: boolean): L.TileLayer {
    layer.on("add", () => {
      const map = (layer as L.TileLayer & {_map?: L.Map})._map;
      if (map) {
        if (showOsLogo) {
          this.osBranding.attachTo(map);
        } else {
          this.osBranding.detachFrom(map);
        }
      }
    });
    return layer;
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
      const location = pageLocation(pageContent);
      if (!location) {
        this.logger.info("syncMarkersFromLocation: no location row found in pageContent rows:", pageContent?.rows);
      } else {
        const hasStartLocation = location.start?.latitude != null && location.start?.longitude != null;
        const hasEndLocation = location.end?.latitude != null && location.end?.longitude != null;
        if (!hasStartLocation && !hasEndLocation) {
          this.logger.info("syncMarkersFromLocation: no start or end location found in location:", location);
        } else {
          this.logger.info("syncMarkersFromLocation: sufficient data to initialise markers map:", row.map, "from pageContent rows:", pageContent?.rows);
          const currentMarkers = row.map.markers || [];
          const desiredMarkers: MapMarker[] = markersSyncedWithLocation(currentMarkers, location);
          if (!this.haveMarkersChanged(currentMarkers, desiredMarkers)) {
            this.logger.info("syncMarkersFromLocation: Markers already synced with location row");
          } else {
            this.logger.info("syncMarkersFromLocation: Auto-syncing markers from location row");
            row.map.markers = desiredMarkers;
            this.logger.info("syncMarkersFromLocation: Auto-synced markers:", row.map.markers, "centered at:", row.map.mapCenter);
          }
        }
      }
    }
  }

  private haveMarkersChanged(current: MapMarker[], next: MapMarker[]): boolean {
    if (current.length !== next.length) {
      return true;
    }
    return next.some((marker, index) => {
      const candidate = current[index];
      if (!candidate) {
        return true;
      }
      return candidate.latitude !== marker.latitude ||
        candidate.longitude !== marker.longitude ||
        candidate.label !== marker.label;
    });
  }
}
