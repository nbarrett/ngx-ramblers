import { Injectable } from "@angular/core";
import * as L from "leaflet";

@Injectable({ providedIn: "root" })
export class MapMarkerStyleService {
  markerIcon(provider: "osm" | "os", style: string): L.Icon | L.DivIcon {
    if (provider === "os" && style?.startsWith("Leisure")) {
      return this.explorerPinIcon();
    }
    return new L.Icon.Default();
  }

  clusterIconCreate(provider: "osm" | "os", style: string): ((cluster: any) => L.DivIcon) | undefined {
    if (provider === "os") {
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

  private explorerPinIcon(): L.DivIcon {
    const html = `
      <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="display:block;color: var(--os-explorer-color)">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="currentColor" stroke="#ffffff" stroke-width="2"/>
        <circle cx="14" cy="14" r="4.5" fill="#ffffff"/>
      </svg>`;
    return L.divIcon({ className: "os-explorer-pin", html, iconSize: [28, 36] as any, iconAnchor: [14, 36] as any, popupAnchor: [0, -28] as any });
  }
}

