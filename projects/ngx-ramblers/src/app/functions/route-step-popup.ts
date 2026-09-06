import { escape } from "es-toolkit";
import { isString } from "es-toolkit/compat";
import { faArrowUp } from "@fortawesome/free-solid-svg-icons";
import { PopupOptions } from "leaflet";
import { MapMarker, RouteGuideEntry } from "../models/content-text.model";
import { ROUTE_STEP_POPUP_CLASS, ROUTE_STEP_POPUP_MAX_WIDTH, ROUTE_STEP_POPUP_MIN_WIDTH } from "../models/route-follow.model";
import { turnRotationDegrees } from "./route-turns";

export const ROUTE_STEP_POPUP_OPTIONS: PopupOptions = {autoPan: false, className: ROUTE_STEP_POPUP_CLASS, minWidth: ROUTE_STEP_POPUP_MIN_WIDTH, maxWidth: ROUTE_STEP_POPUP_MAX_WIDTH};

export function milesFromStart(metres: number): string {
  return `${(metres / 1609.344).toFixed(1)} miles from the start`;
}

export function routeStepPopupHtml(marker: MapMarker, entry: RouteGuideEntry | undefined, colour: string): string {
  const [width, height, , , pathData] = faArrowUp.icon;
  const path = isString(pathData) ? pathData : pathData.join(" ");
  const turn = marker.turn ? `<svg class="route-guide-turn" viewBox="0 0 ${width} ${height}" width="12" height="12" style="transform:rotate(${turnRotationDegrees(marker.turn)}deg)" aria-hidden="true"><path fill="currentColor" d="${path}"/></svg>` : "";
  const distance = entry && entry.distanceMetres !== null ? escape(milesFromStart(entry.distanceMetres)) : "";
  const note = marker.note ? `<span class="route-guide-note">${escape(marker.note)}</span>` : "";
  return `<div class="route-step-card"><span class="route-guide-number" style="background:${colour}">${escape(marker.label || "")}</span><span class="route-guide-body"><span class="route-guide-distance">${turn}${distance}</span><span class="route-step-instruction">${escape(marker.instruction || "")}</span>${note}</span></div>`;
}
