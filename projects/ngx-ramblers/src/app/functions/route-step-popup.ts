import { isString } from "es-toolkit/compat";
import { faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { PopupOptions } from "leaflet";
import { MapMarker, RouteGuideEntry } from "../models/content-text.model";
import { ROUTE_STEP_POPUP_CLASS, ROUTE_STEP_POPUP_MAX_WIDTH, ROUTE_STEP_POPUP_MIN_WIDTH } from "../models/route-follow.model";
import { turnRotationDegrees } from "./route-turns";
import { escapeHtml } from "./strings";

export const ROUTE_STEP_POPUP_OPTIONS: PopupOptions = {autoPan: false, className: ROUTE_STEP_POPUP_CLASS, minWidth: ROUTE_STEP_POPUP_MIN_WIDTH, maxWidth: ROUTE_STEP_POPUP_MAX_WIDTH};

export function milesFromStart(metres: number): string {
  return `${(metres / 1609.344).toFixed(1)} miles from the start`;
}

export const MAP_PIN_POPUP_OPTIONS: PopupOptions = {...ROUTE_STEP_POPUP_OPTIONS, autoClose: true, closeOnClick: true};

export function mapPinPopupHtml(parts: {label?: string; colour: string; headingHtml?: string; instruction?: string; note?: string}): string {
  const number = parts.label ? `<span class="route-guide-number" style="background:${parts.colour}">${escapeHtml(parts.label)}</span>` : "";
  const heading = parts.headingHtml ? `<span class="route-guide-distance">${parts.headingHtml}</span>` : "";
  const instruction = parts.instruction ? `<span class="route-step-instruction">${escapeHtml(parts.instruction)}</span>` : "";
  const note = parts.note ? `<span class="route-guide-note">${escapeHtml(parts.note)}</span>` : "";
  return `<div class="route-step-card">${number}<span class="route-guide-body">${heading}${instruction}${note}</span></div>`;
}

export function locationPinPopupHtml(colour: string, title: string, details: (string | null)[], label = ""): string {
  return mapPinPopupHtml({
    label,
    colour,
    instruction: title,
    note: details.filter(detail => isString(detail) && detail.trim()).join("\n")
  });
}

export function routeStepPopupHtml(marker: MapMarker, entry: RouteGuideEntry | undefined, colour: string): string {
  const [width, height, , , pathData] = faArrowUp.icon;
  const path = isString(pathData) ? pathData : pathData.join(" ");
  const turn = marker.turn ? `<svg class="route-guide-turn" viewBox="0 0 ${width} ${height}" width="12" height="12" style="transform:rotate(${turnRotationDegrees(marker.turn)}deg)" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>` : "";
  const distance = entry && entry.distanceMetres !== null ? escapeHtml(milesFromStart(entry.distanceMetres)) : "";
  return mapPinPopupHtml({
    label: marker.label || "",
    colour,
    headingHtml: `${turn}${distance}`,
    instruction: marker.instruction,
    note: marker.note
  });
}
