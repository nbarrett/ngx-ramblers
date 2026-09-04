import { Injectable } from "@angular/core";
import * as L from "leaflet";
import { MapProvider } from "../../models/map.model";
import { HEADING_RING_CLASS } from "../../models/route-follow.model";
import { WalkStatus } from "../../models/ramblers-walks-manager";

@Injectable({ providedIn: "root" })
export class MapMarkerStyleService {
  markerIcon(provider: MapProvider, style: string, walkStatus?: WalkStatus): L.Icon | L.DivIcon {
    if (provider === MapProvider.OS) {
      return this.explorerPinIcon(walkStatus);
    }
    return new L.Icon.Default();
  }

  numberedMarkerColour(provider: MapProvider | string | undefined): string {
    return provider === MapProvider.OS ? "#453C90" : "#c21d4b";
  }

  numberedMarkerIcon(label: string, provider: MapProvider, style: string, travelBearing: number | null = null): L.DivIcon {
    const color = this.numberedMarkerColour(provider);
    const text = (label || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const fontSize = text.length > 2 ? 9 : 12;
    const heading = travelBearing === null ? "" : this.headingRingHtml(color, travelBearing);
    const html = `${heading}
      <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg" style="display:block;color:${color}">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.268 21.732 0 14 0z" fill="currentColor" stroke="#ffffff" stroke-width="2"/>
        <circle cx="14" cy="14" r="8" fill="#ffffff"/>
        <text x="14" y="14" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="700" fill="currentColor">${text}</text>
      </svg>`;
    return L.divIcon({ className: "ngx-numbered-pin", html, iconSize: [28, 36] as any, iconAnchor: [14, 36] as any, popupAnchor: [0, travelBearing === null ? -28 : -58] as any });
  }

  headingRingIcon(provider: MapProvider | string | undefined, travelBearing: number): L.DivIcon {
    return L.divIcon({className: HEADING_RING_CLASS, html: this.headingRingHtml(this.numberedMarkerColour(provider), travelBearing), iconSize: [56, 56], iconAnchor: [28, 28]});
  }

  private headingRingHtml(color: string, travelBearing: number): string {
    return `
      <div class="ngx-pin-heading">
        <div class="ngx-pin-heading-inner" style="--pin-bearing:${travelBearing}deg">
          <svg width="56" height="56" viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg" style="display:block;color:${color}">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#ffffff" stroke-width="6"/>
            <circle cx="28" cy="28" r="22" fill="none" stroke="currentColor" stroke-width="3"/>
            <polygon points="28,0 18,13 38,13" fill="currentColor" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>`;
  }

  followLocationIcon(heading: number): L.DivIcon {
    const rotation = heading || 0;
    const html = `<div class="follow-location-chevron" style="transform:rotate(${rotation}deg)">
      <svg width="18" height="20" viewBox="0 0 26 28" aria-hidden="true">
        <path d="M13 2.2 L23.8 24.6 L13 18.8 L2.2 24.6 Z" fill="#d81b60" stroke="#ffffff" stroke-width="2.3" stroke-linejoin="round" stroke-linecap="round"/>
      </svg>
    </div>`;
    return L.divIcon({
      className: "follow-leaflet-icon follow-pointer-icon",
      html,
      iconSize: [18, 20],
      iconAnchor: [9, 11]
    });
  }

  osRouteArrowIcon(heading: number, weight = 6): L.DivIcon {
    const size = Math.max(10, Math.min(weight * 1.5, 12));
    const html = `<div class="follow-route-arrow" style="transform:rotate(${heading}deg)">
      <svg viewBox="0 0 12 12" width="${size}" height="${size}" aria-hidden="true">
        <path d="M6 1.6 L10.2 10.4 L6 8.1 L1.8 10.4 Z" fill="#ffffff"/>
      </svg>
    </div>`;
    return L.divIcon({
      className: "follow-leaflet-icon",
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });
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
    const color = isCancelled ? "#999999" : "#453C90";
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
