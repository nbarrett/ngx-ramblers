import { inject, Injectable } from "@angular/core";
import * as L from "leaflet";
import { LocatePinSelection, LocatePoint, LocateSavedPoint } from "../../models/locate.model";
import { MapProvider } from "../../models/map.model";
import { MapMarkerStyleService } from "./map-marker-style.service";

@Injectable()
export class LocateMarkersService {
  private styles = inject(MapMarkerStyleService);
  private group: L.FeatureGroup | null = null;
  private markers = new Map<string, L.Marker>();
  private provider = MapProvider.OSM;
  private style = "";
  private select: (selection: LocatePinSelection) => void = () => null;

  attach(map: L.Map, provider: MapProvider, style: string, select: (selection: LocatePinSelection) => void): void {
    this.group?.remove();
    this.group = L.featureGroup().addTo(map);
    this.markers.clear();
    this.provider = provider;
    this.style = style;
    this.select = select;
  }

  bounds(): L.LatLngBounds | null {
    return this.group && this.markers.size ? this.group.getBounds() : null;
  }

  render(point: LocatePoint | null, saved: LocateSavedPoint[], activeId: string | null, caption: (point: LocatePoint, name: string | null) => string): void {
    if (this.group) {
      const retained = new Set([...saved.map(item => item.id), ...(point && !activeId ? ["draft"] : [])]);
      this.markers.forEach((marker, id) => {
        if (!retained.has(id)) {
          this.group.removeLayer(marker);
          this.markers.delete(id);
        }
      });
      saved.forEach(item => this.updateMarker(item.point, item.id, item.number, caption(item.point, item.name)));
      if (point && !activeId) {
        this.updateMarker(point, null, null, caption(point, null));
      }
    }
  }

  setCaption(id: string | null, caption: string): void {
    const marker = this.markers.get(id || "draft");
    if (marker) {
      marker.getTooltip()?.setContent(caption);
      marker.openTooltip();
    }
  }

  private updateMarker(point: LocatePoint, id: string | null, number: number | null, caption: string): void {
    const existing = this.markers.get(id || "draft");
    if (existing) {
      existing.setLatLng([point.latitude, point.longitude]);
      this.applyCaption(existing, caption);
    } else {
      this.addMarker(point, id, number, caption);
    }
  }

  private addMarker(point: LocatePoint, id: string | null, number: number | null, caption: string): void {
    const icon = number ? this.styles.numberedMarkerIcon(String(number), this.provider, this.style) : this.styles.markerIcon(this.provider, this.style);
    const marker = L.marker([point.latitude, point.longitude], {icon, draggable: true, alt: caption});
    marker.bindTooltip(caption, {direction: "top", offset: [0, -36], opacity: 1});
    const emitSelection = (settled: boolean) => {
      const position = marker.getLatLng();
      this.select({id, latitude: position.lat, longitude: position.lng, settled});
    };
    marker.on("click", () => emitSelection(true));
    marker.on("dragstart drag", () => emitSelection(false));
    marker.on("dragend", () => emitSelection(true));
    this.group?.addLayer(marker);
    this.markers.set(id || "draft", marker);
  }

  private applyCaption(marker: L.Marker, caption: string): void {
    const tooltip = marker.getTooltip();
    if (tooltip) {
      tooltip.setContent(caption);
    } else {
      marker.bindTooltip(caption, {direction: "top", offset: [0, -36], opacity: 1});
    }
  }
}
