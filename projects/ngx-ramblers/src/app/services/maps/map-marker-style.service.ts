import { Injectable } from "@angular/core";
import * as L from "leaflet";
import { MapProvider } from "../../models/map.model";
import { WalkStatus } from "../../models/ramblers-walks-manager";

@Injectable({ providedIn: "root" })
export class MapMarkerStyleService {
  markerIcon(provider: MapProvider, style: string, walkStatus?: WalkStatus): L.Icon | L.DivIcon {
    if (provider === MapProvider.OS) {
      return this.explorerPinIcon(walkStatus);
    }
    return new L.Icon.Default();
  }

  clusterIconCreate(provider: MapProvider, style: string): ((cluster: any) => L.DivIcon) | undefined {
    if (provider === MapProvider.OS) {
      return (cluster: any) => {
        const childCount = cluster.getChildCount();
        const c = childCount < 10 ? "small" : childCount < 50 ? "medium" : "large";
        return L.divIcon({
          html: `<span>${childCount}</span>`,
          className: `os-explorer-cluster marker-cluster marker-cluster-${c}`,
          iconSize: undefined as any
        });
      };
    }
    return undefined;
  }

  private explorerPinIcon(walkStatus?: WalkStatus): L.DivIcon {
    const isCancelled = walkStatus === WalkStatus.CANCELLED;
    const color = isCancelled ? "#999999" : "var(--os-explorer-color)";
    const opacity = isCancelled ? "0.6" : "1";
    const html = `
      <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="display:block;color: ${color};opacity:${opacity}">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="currentColor" stroke="#ffffff" stroke-width="2"/>
        <circle cx="14" cy="14" r="4.5" fill="#ffffff"/>
        ${isCancelled ? `<line x1="8" y1="8" x2="20" y2="20" stroke="#ffffff" stroke-width="2"/><line x1="20" y1="8" x2="8" y2="20" stroke="#ffffff" stroke-width="2"/>` : ``}
      </svg>`;
    return L.divIcon({ className: "os-explorer-pin", html, iconSize: [28, 36] as any, iconAnchor: [14, 36] as any, popupAnchor: [0, -28] as any });
  }
}
