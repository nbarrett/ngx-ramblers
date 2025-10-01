import { Injectable } from "@angular/core";
import * as L from "leaflet";

export interface MapRecreationContext {
  mapRef?: L.Map;
  savedCenter?: L.LatLng | null;
  savedZoom?: number;
  preserveNextView?: boolean;
  showMap?: boolean;
  logger?: any;
  leafletLayers?: L.Layer[];
  clusterGroupRef?: any;
  allMarkers?: L.Marker[];
  openPopupCount?: number;
  fitBounds?: L.LatLngBounds | undefined;
  options?: any;
}

export interface MapRecreationCallbacks {
  onRebuildMap: () => void;
  onSetShowMap: (show: boolean) => void;
  onAfterShowMap?: () => void;
}

@Injectable({
  providedIn: "root"
})
export class MapRecreationService {

  recreateMap(
    context: MapRecreationContext,
    callbacks: MapRecreationCallbacks,
    preserveView = false
  ): void {
    if (context.logger) {
      context.logger.info("recreateMap: tearing down and rebuilding map for provider/style change");
    }
    if (preserveView && context.mapRef) {
      try {
        context.savedCenter = context.mapRef.getCenter();
      } catch {
        context.savedCenter = null;
      }
      context.savedZoom = context.mapRef.getZoom();
      context.preserveNextView = true;
    }

    if (context.mapRef) {
      context.mapRef.remove();
      context.mapRef = undefined;
    }

    if (context.leafletLayers) context.leafletLayers.length = 0;
    if (context.clusterGroupRef !== undefined) context.clusterGroupRef = undefined;
    if (context.allMarkers) context.allMarkers.length = 0;
    if (context.openPopupCount !== undefined) context.openPopupCount = 0;
    if (context.fitBounds !== undefined) context.fitBounds = undefined;
    if (context.options !== undefined) context.options = null;

    callbacks.onSetShowMap(false);

    setTimeout(() => {
      callbacks.onSetShowMap(true);
      requestAnimationFrame(() => setTimeout(() => {
        callbacks.onRebuildMap();
        callbacks.onAfterShowMap?.();
      }, 0));
    }, 50);
  }
}