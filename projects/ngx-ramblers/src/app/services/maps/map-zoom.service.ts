import { Injectable, inject } from "@angular/core";
import * as L from "leaflet";
import { Logger, LoggerFactory } from "../logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

export interface FitBoundsOptions {
  paddingPercent?: number;
  maxZoom?: number;
}

export interface SinglePointZoomOptions {
  defaultZoom?: number;
  mapMaxZoom?: number;
}

@Injectable({ providedIn: "root" })
export class MapZoomService {
  private logger: Logger = inject(LoggerFactory).createLogger("MapZoomService", NgxLoggerLevel.ERROR);

  calculateBoundsFromLayers(layers: L.Layer[], options: FitBoundsOptions = {}): L.LatLngBounds | null {
    const paddingPercent = options.paddingPercent ?? 0.15;
    const allLatLngs: L.LatLng[] = [];

    this.logger.info("calculateBoundsFromLayers: Processing", layers.length, "layers");

    layers.forEach((layer, index) => {
      if (!layer) {
        this.logger.warn(`calculateBoundsFromLayers: Layer ${index} is undefined, skipping`);
        return;
      }
      const layerLatLngs = this.latLngsFromLayer(layer);
      this.logger.info(`calculateBoundsFromLayers: Layer ${index} (${layer.constructor.name}) contributed ${layerLatLngs.length} points`);
      allLatLngs.push(...layerLatLngs);
    });

    this.logger.info("calculateBoundsFromLayers: Total points collected:", allLatLngs.length);

    if (allLatLngs.length === 0) {
      return null;
    }

    const bounds = L.latLngBounds(allLatLngs);
    const paddedBounds = bounds.pad(paddingPercent);

    this.logger.info(
      "calculateBoundsFromLayers: Bounds set to:",
      paddedBounds.getSouthWest(),
      "to",
      paddedBounds.getNorthEast(),
      `(with ${paddingPercent * 100}% padding)`
    );

    return paddedBounds;
  }

  calculateSinglePointZoom(map: L.Map, options: SinglePointZoomOptions = {}): number {
    const defaultZoom = options.defaultZoom ?? 15;
    const mapMaxZoom = options.mapMaxZoom ?? map.getMaxZoom();

    const current = map.getZoom() || defaultZoom;
    const clamped = Math.min(current, mapMaxZoom);
    const zoomLevel = Math.max(12, Math.min(clamped, defaultZoom));

    this.logger.info("calculateSinglePointZoom: Calculated zoom level:", zoomLevel);
    return zoomLevel;
  }

  applyBoundsToMap(map: L.Map, bounds: L.LatLngBounds, options: FitBoundsOptions = {}): void {
    const maxZoom = options.maxZoom ?? 15;

    this.logger.info("applyBoundsToMap: Applying bounds with maxZoom:", maxZoom);

    try {
      map.fitBounds(bounds, { maxZoom });
    } catch (error) {
      this.logger.error("applyBoundsToMap: Error applying bounds:", error);
    }
  }

  invalidateAndApplyBounds(map: L.Map, bounds: L.LatLngBounds | null, options: FitBoundsOptions = {}): void {
    if (!map) {
      this.logger.warn("invalidateAndApplyBounds: Map is not initialized");
      return;
    }

    map.invalidateSize();

    if (bounds) {
      setTimeout(() => {
        this.applyBoundsToMap(map, bounds, options);
      }, 100);
    }
  }

  private latLngsFromLayer(layer: L.Layer): L.LatLng[] {
    const latLngs: L.LatLng[] = [];

    if (layer instanceof L.Marker) {
      latLngs.push(layer.getLatLng());
    } else if (layer instanceof L.Polyline) {
      const lls = layer.getLatLngs();
      if (Array.isArray(lls)) {
        this.flattenLatLngs(lls, latLngs);
      }
    } else if (layer instanceof L.Polygon) {
      const lls = layer.getLatLngs();
      if (Array.isArray(lls)) {
        this.flattenLatLngs(lls, latLngs);
      }
    } else if (layer instanceof L.Circle) {
      latLngs.push(layer.getLatLng());
    } else if ((layer as any).getLayers) {
      const subLayers = (layer as any).getLayers();
      if (Array.isArray(subLayers)) {
        subLayers.forEach(subLayer => {
          latLngs.push(...this.latLngsFromLayer(subLayer));
        });
      }
    }

    return latLngs;
  }

  private flattenLatLngs(arr: any[], output: L.LatLng[]): void {
    arr.forEach(item => {
      if (item instanceof L.LatLng) {
        output.push(item);
      } else if (Array.isArray(item)) {
        this.flattenLatLngs(item, output);
      }
    });
  }
}
