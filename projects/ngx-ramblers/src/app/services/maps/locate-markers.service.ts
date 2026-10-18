import { inject, Injectable } from "@angular/core";
import * as L from "leaflet";
import { MAP_PIN_POPUP_OPTIONS, locationPinPopupHtml } from "../../functions/route-step-popup";
import { LocatePinPopup, LocatePinSelection, LocatePoint, LocateSavedPoint } from "../../models/locate.model";
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

  render(point: LocatePoint | null, saved: LocateSavedPoint[], activeId: string | null, popup: (point: LocatePoint, name: string | null) => LocatePinPopup): void {
    if (this.group) {
      const retained = new Set([...saved.map(item => item.id), ...(point && !activeId ? ["draft"] : [])]);
      this.markers.forEach((marker, id) => {
        if (!retained.has(id)) {
          this.group.removeLayer(marker);
          this.markers.delete(id);
        }
      });
      saved.forEach(item => this.updateMarker(item.point, item.id, item.number, popup(item.point, item.name), item.id === activeId));
      if (point && !activeId) {
        this.updateMarker(point, null, null, popup(point, null), true);
      }
    }
  }

  setCaption(id: string | null, popup: LocatePinPopup, number: number | null = null): void {
    const marker = this.markers.get(id || "draft");
    if (marker) {
      this.applyPopup(marker, number, popup);
      this.openExclusivePopup(marker);
    }
  }

  private updateMarker(point: LocatePoint, id: string | null, number: number | null, popup: LocatePinPopup, showPopup: boolean): void {
    const existing = this.markers.get(id || "draft");
    if (existing) {
      existing.setLatLng([point.latitude, point.longitude]);
      existing.setIcon(this.pinIcon(number));
      existing.options.alt = popup.title;
      this.applyPopup(existing, number, popup);
      if (showPopup) {
        this.openExclusivePopup(existing);
      } else {
        existing.closePopup();
      }
    } else {
      this.addMarker(point, id, number, popup, showPopup);
    }
  }

  private pinIcon(number: number | null): L.Icon | L.DivIcon {
    return number ? this.styles.numberedMarkerIcon(String(number), this.provider, this.style) : this.styles.markerIcon(this.provider, this.style);
  }

  private addMarker(point: LocatePoint, id: string | null, number: number | null, popup: LocatePinPopup, showPopup: boolean): void {
    const marker = L.marker([point.latitude, point.longitude], {icon: this.pinIcon(number), draggable: true, alt: popup.title});
    this.applyPopup(marker, number, popup);
    const emitSelection = (settled: boolean) => {
      const position = marker.getLatLng();
      this.select({id, latitude: position.lat, longitude: position.lng, settled});
    };
    marker.on("click", () => emitSelection(true));
    marker.on("dragstart drag", () => emitSelection(false));
    marker.on("dragend", () => emitSelection(true));
    this.group?.addLayer(marker);
    this.markers.set(id || "draft", marker);
    if (showPopup) {
      this.openExclusivePopup(marker);
    }
  }

  private openExclusivePopup(marker: L.Marker): void {
    this.markers.forEach(item => {
      if (item !== marker) {
        item.closePopup();
      }
    });
    marker.openPopup();
  }

  private applyPopup(marker: L.Marker, number: number | null, popup: LocatePinPopup): void {
    const html = locationPinPopupHtml(
      this.styles.numberedMarkerColour(this.provider),
      popup.title,
      [popup.note],
      number ? String(number) : ""
    );
    const existing = marker.getPopup();
    if (existing) {
      existing.setContent(html);
    } else {
      marker.bindPopup(html, MAP_PIN_POPUP_OPTIONS);
    }
  }
}
