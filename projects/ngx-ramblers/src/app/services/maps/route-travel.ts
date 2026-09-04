import * as L from "leaflet";
import { ROUTE_STEP_SPEED_DEFAULT, ROUTE_TRAVEL_HEADING_SMOOTHING, ROUTE_TRAVEL_MAX_MS, ROUTE_TRAVEL_MIN_MS, ROUTE_TRAVEL_MS_PER_METRE, ROUTE_TRAVEL_RING_LIFT_PX, ROUTE_TRAVEL_SETTLE_FROM, RouteTravelOptions } from "../../models/route-follow.model";
import { cumulativeDistances, pointAlongRoute } from "../../functions/route-geometry";
import { travelBearingAt } from "../../functions/route-turns";
import { mapAngleDelta, mapGesturesFor } from "./map-gestures";

export function routeTravelDuration(metres: number, speed = ROUTE_STEP_SPEED_DEFAULT): number {
  return Math.min(ROUTE_TRAVEL_MAX_MS, Math.max(ROUTE_TRAVEL_MIN_MS, metres * ROUTE_TRAVEL_MS_PER_METRE)) / (speed > 0 ? speed : ROUTE_STEP_SPEED_DEFAULT);
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function ringLift(t: number): number {
  return t <= ROUTE_TRAVEL_SETTLE_FROM ? 0 : -ROUTE_TRAVEL_RING_LIFT_PX * easeInOut((t - ROUTE_TRAVEL_SETTLE_FROM) / (1 - ROUTE_TRAVEL_SETTLE_FROM));
}

export function travelAlongRoute(options: RouteTravelOptions): () => void {
  const {map, points, fromIndex, toIndex, headingUp, travellerIcon, speed, onDone} = options;
  const cumulative = cumulativeDistances(points);
  const start = cumulative[fromIndex] || 0;
  const end = cumulative[toIndex] || 0;
  const duration = routeTravelDuration(Math.abs(end - start), speed);
  const gestures = mapGesturesFor(map);
  const traveller = travellerIcon ? L.marker([points[fromIndex].latitude, points[fromIndex].longitude], {icon: travellerIcon, interactive: false, keyboard: false, zIndexOffset: 1000}).addTo(map) : null;
  const state = {frame: 0, cancelled: false, startedAt: 0, bearing: gestures ? -gestures.currentBearing() : 0};
  const finish = () => {
    traveller?.remove();
  };
  const step = (now: number) => {
    if (!state.cancelled) {
      state.startedAt = state.startedAt || now;
      const t = Math.min(1, (now - state.startedAt) / duration);
      const along = pointAlongRoute(points, cumulative, start + (end - start) * easeInOut(t));
      const lineBearing = travelBearingAt(points, along.index);
      map.panTo([along.point.latitude, along.point.longitude], {animate: false});
      if (traveller) {
        traveller.setLatLng([along.point.latitude, along.point.longitude]);
        const inner = traveller.getElement()?.querySelector<HTMLElement>(".ngx-pin-heading-inner");
        inner?.style.setProperty("--pin-bearing", `${lineBearing ?? 0}deg`);
        inner?.style.setProperty("--pin-lift", `${ringLift(t)}px`);
      }
      if (headingUp && gestures && lineBearing !== null) {
        state.bearing = t >= 1 ? lineBearing : state.bearing + mapAngleDelta(state.bearing, lineBearing) * ROUTE_TRAVEL_HEADING_SMOOTHING;
        gestures.setBearing(-state.bearing, t >= 1);
      }
      if (t < 1) {
        state.frame = requestAnimationFrame(step);
      } else {
        finish();
        if (onDone) {
          onDone();
        }
      }
    }
  };
  state.frame = requestAnimationFrame(step);
  return () => {
    state.cancelled = true;
    cancelAnimationFrame(state.frame);
    finish();
  };
}
