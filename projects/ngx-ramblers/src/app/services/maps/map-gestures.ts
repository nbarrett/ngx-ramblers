import * as L from "leaflet";
import { MAP_BEARING_TRANSITION_MS, MAP_GESTURES_FRAME_CLASS, MapCoverSize, MapGestureAnchor, RouteFollowReturnDirection } from "../../models/route-follow.model";

const gesturesByMap = new WeakMap<L.Map, MapGestures>();
const installState = {done: false};

export function mapAngleDelta(from: number, to: number): number {
  return ((to - from + 540) % 360) - 180;
}

export function unwrapBearing(current: number, next: number): number {
  return current + mapAngleDelta(((current % 360) + 360) % 360, next);
}

export function returnDirectionFrom(heading: number, bearingToRoute: number): RouteFollowReturnDirection {
  const turn = mapAngleDelta(heading, bearingToRoute);
  const absolute = Math.abs(turn);
  if (absolute <= 45) {
    return RouteFollowReturnDirection.FORWARD;
  } else if (absolute >= 135) {
    return RouteFollowReturnDirection.BACK;
  } else if (turn > 0) {
    return RouteFollowReturnDirection.RIGHT;
  } else {
    return RouteFollowReturnDirection.LEFT;
  }
}

export function screenDeltaToLocal(dx: number, dy: number, bearing: number, scale = 1): {x: number; y: number} {
  const radians = (-bearing * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const safeScale = scale || 1;
  return {
    x: (dx * cos - dy * sin) / safeScale,
    y: (dx * sin + dy * cos) / safeScale
  };
}

export function mapGesturesFor(map: L.Map): MapGestures | null {
  return gesturesByMap.get(map) || null;
}

export function installLeafletMapGestures(): void {
  if (installState.done) {
    return;
  } else {
    installState.done = true;
    L.Map.addInitHook(function(this: L.Map) {
      const gestures = new MapGestures();
      gesturesByMap.set(this, gestures);
      this.whenReady(() => {
        gestures.attach(this);
        if (this.options.zoomControl) {
          gestures.addNorthControl();
        }
      });
      this.on("unload", () => {
        gestures.detach();
        gesturesByMap.delete(this);
      });
    });
  }
}

export class MapGestures {
  private map: L.Map | null = null;
  private bearing = 0;
  private displayBearing = 0;
  private settleTimer: ReturnType<typeof setTimeout> | null = null;
  private pinchActive = false;
  private anchor: MapGestureAnchor | null = null;
  private onBearing: ((bearing: number) => void) | null = null;
  private onUserRotate: (() => void) | null = null;
  private originalToContainer: ((event: MouseEvent) => L.Point) | null = null;
  private northButton: HTMLElement | null = null;
  private northControl: L.Control | null = null;
  private coverScale = 1;
  private coverSize: MapCoverSize | null = null;
  private gesture = {active: false, startBearing: 0};
  private hookedDraggable: {on: (type: string, fn: () => void) => void; off: (type: string, fn: () => void) => void} | null = null;

  attach(map: L.Map, onBearing?: (bearing: number) => void): void {
    this.detach();
    this.map = map;
    this.onBearing = onBearing || this.onBearing;
    this.originalToContainer = map.mouseEventToContainerPoint.bind(map);
    map.mouseEventToContainerPoint = (event: MouseEvent) => this.containerPointFromClient(event.clientX, event.clientY);
    if (map.touchZoom) {
      map.touchZoom.disable();
    }
    const el = map.getContainer();
    el.style.touchAction = "none";
    el.classList.add("map-gestures-enabled");
    el.addEventListener("touchstart", this.onTouchStart, {passive: false, capture: true});
    el.addEventListener("touchmove", this.onTouchMove, {passive: false, capture: true});
    el.addEventListener("touchend", this.onTouchEnd, {passive: false, capture: true});
    el.addEventListener("touchcancel", this.onTouchEnd, {passive: false, capture: true});
    el.addEventListener("gesturestart", this.onGestureStart, {passive: false, capture: true});
    el.addEventListener("gesturechange", this.onGestureChange, {passive: false, capture: true});
    el.addEventListener("gestureend", this.onGestureEnd, {passive: false, capture: true});
    map.on("resize", this.onMapResize);
    this.applyBearing();
    this.hookDragCorrection();
  }

  detach(): void {
    if (this.map) {
      const el = this.map.getContainer();
      el.removeEventListener("touchstart", this.onTouchStart, true);
      el.removeEventListener("touchmove", this.onTouchMove, true);
      el.removeEventListener("touchend", this.onTouchEnd, true);
      el.removeEventListener("touchcancel", this.onTouchEnd, true);
      el.removeEventListener("gesturestart", this.onGestureStart, true);
      el.removeEventListener("gesturechange", this.onGestureChange, true);
      el.removeEventListener("gestureend", this.onGestureEnd, true);
      this.map.off("resize", this.onMapResize);
      this.clearSettleTimer();
      el.classList.remove("map-gestures-enabled");
      if (this.originalToContainer) {
        this.map.mouseEventToContainerPoint = this.originalToContainer;
      }
      if (this.map.touchZoom) {
        this.map.touchZoom.enable();
      }
      if (this.map.dragging) {
        this.map.dragging.enable();
      }
      if (this.northControl) {
        this.map.removeControl(this.northControl);
      }
      el.style.transform = "";
    }
    this.unhookDragCorrection();
    this.map = null;
    this.originalToContainer = null;
    this.anchor = null;
    this.pinchActive = false;
    this.northButton = null;
    this.northControl = null;
    this.coverScale = 1;
  }

  setOnBearing(onBearing: ((bearing: number) => void) | null): void {
    this.onBearing = onBearing;
  }

  setOnUserRotate(onUserRotate: (() => void) | null): void {
    this.onUserRotate = onUserRotate;
  }

  resetNorth(animate = false): void {
    this.setBearing(0, animate);
  }

  setBearing(next: number, animate = false): void {
    const normalised = ((next % 360) + 360) % 360;
    this.bearing = normalised > 180 ? normalised - 360 : normalised;
    this.applyBearing(animate);
    if (this.onBearing) {
      this.onBearing(this.bearing);
    }
  }

  currentBearing(): number {
    return this.bearing;
  }

  addNorthControl(): void {
    if (!this.map || this.northControl) {
      return;
    } else {
      const onNorthClick = (event: Event) => {
        L.DomEvent.stop(event);
        if (this.onUserRotate) {
          this.onUserRotate();
        }
        this.resetNorth(true);
      };
      const NorthControl = L.Control.extend({
        options: {position: "topleft"},
        onAdd: () => {
          const wrap = L.DomUtil.create("div", "leaflet-bar leaflet-control map-north-control-wrap");
          const button = L.DomUtil.create("button", "map-north-control", wrap);
          button.type = "button";
          button.title = "Reset map to north";
          button.setAttribute("aria-label", "Reset map to north");
          button.textContent = "N";
          L.DomEvent.disableClickPropagation(wrap);
          L.DomEvent.disableScrollPropagation(wrap);
          L.DomEvent.on(button, "dblclick", L.DomEvent.stop);
          L.DomEvent.on(button, "click", onNorthClick);
          this.northButton = button;
          return wrap;
        }
      });
      this.northControl = new NorthControl();
      this.map.addControl(this.northControl);
      this.updateNorthControl();
    }
  }

  private onGestureStart = (event: Event): void => {
    event.preventDefault();
    this.gesture = {active: true, startBearing: this.bearing};
    if (this.onUserRotate) {
      this.onUserRotate();
    }
  };

  private onGestureChange = (event: Event): void => {
    const rotation = (event as Event & {rotation?: number}).rotation;
    if (this.gesture.active && rotation !== undefined && this.map) {
      event.preventDefault();
      this.setBearing(this.gesture.startBearing + rotation);
    }
  };

  private onGestureEnd = (event: Event): void => {
    event.preventDefault();
    this.gesture = {active: false, startBearing: this.bearing};
  };

  private onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length === 2 && this.map) {
      event.preventDefault();
      this.pinchActive = true;
      if (this.onUserRotate) {
        this.onUserRotate();
      }
      if (this.map.dragging) {
        this.map.dragging.disable();
      }
      this.anchor = this.snapshot(event);
    }
  };

  private onTouchMove = (event: TouchEvent): void => {
    if (!this.pinchActive || event.touches.length !== 2 || !this.map || !this.anchor) {
      return;
    } else {
      event.preventDefault();
      const next = this.measure(event);
      if (this.anchor.distance < 8) {
        return;
      } else {
        const scale = next.distance / this.anchor.distance;
        const zoom = this.anchor.zoom + Math.log2(scale);
        const minZoom = this.map.getMinZoom();
        const maxZoom = this.map.getMaxZoom();
        const snapped = Math.round(zoom);
        const bounded = snapped < minZoom ? minZoom : (snapped > maxZoom ? maxZoom : snapped);
        this.bearing = this.anchor.bearing + mapAngleDelta(this.anchor.angle, next.angle);
        this.applyBearing();
        const mid = this.midpointFromEvent(event);
        if (bounded !== this.map.getZoom()) {
          this.map.setZoomAround(this.map.containerPointToLatLng(mid), bounded, {animate: false});
        } else {
          const panX = this.anchor.midX - mid.x;
          const panY = this.anchor.midY - mid.y;
          if (panX !== 0 || panY !== 0) {
            this.map.panBy([panX, panY], {animate: false});
          }
        }
        this.anchor = {...this.anchor, midX: mid.x, midY: mid.y};
        if (this.onBearing) {
          this.onBearing(this.bearing);
        }
      }
    }
  };

  private onTouchEnd = (event: TouchEvent): void => {
    if (!this.map) {
      return;
    } else if (event.touches.length === 2) {
      this.anchor = this.snapshot(event);
    } else {
      this.pinchActive = false;
      this.anchor = null;
      const snapped = Math.round(this.map.getZoom());
      if (snapped !== this.map.getZoom()) {
        this.map.setZoom(snapped, {animate: false});
      }
      if (this.map.dragging) {
        this.map.dragging.enable();
      }
      this.hookDragCorrection();
    }
  };

  private snapshot(event: TouchEvent): MapGestureAnchor {
    const measured = this.measure(event);
    const mid = this.midpointFromEvent(event);
    return {
      distance: measured.distance,
      angle: measured.angle,
      zoom: this.map ? this.map.getZoom() : 0,
      bearing: this.bearing,
      midX: mid.x,
      midY: mid.y
    };
  }

  private midpointFromEvent(event: TouchEvent): L.Point {
    return this.containerPointFromClient(
      (event.touches[0].clientX + event.touches[1].clientX) / 2,
      (event.touches[0].clientY + event.touches[1].clientY) / 2
    );
  }

  private measure(event: TouchEvent): {distance: number; angle: number} {
    const first = event.touches[0];
    const second = event.touches[1];
    const dx = second.clientX - first.clientX;
    const dy = second.clientY - first.clientY;
    return {
      distance: Math.hypot(dx, dy),
      angle: Math.atan2(dy, dx) * 180 / Math.PI
    };
  }

  private onMapResize = (): void => {
    this.applyBearing();
  };

  private applyBearing(animate = false): void {
    if (this.map) {
      const el = this.map.getContainer();
      const parent = el.parentElement;
      const transition = animate ? MAP_BEARING_TRANSITION_MS : 0;
      this.displayBearing = unwrapBearing(this.displayBearing, this.bearing);
      this.clearSettleTimer();
      el.style.transformOrigin = "center center";
      el.style.setProperty("--map-bearing", `${this.displayBearing}deg`);
      el.style.setProperty("--map-bearing-transition", `${transition}ms`);
      el.style.transition = transition ? `transform ${transition}ms ease` : "none";
      this.coverScale = 1;
      if (this.bearing === 0) {
        el.style.transform = transition ? `rotate(${this.displayBearing}deg)` : "none";
        if (transition) {
          this.settleTimer = setTimeout(() => this.settleNorth(), transition);
        } else {
          this.restoreCoverSize(el, parent);
        }
      } else {
        const frameWidth = parent?.clientWidth || 0;
        const frameHeight = parent?.clientHeight || 0;
        if (parent && frameWidth >= 2 && frameHeight >= 2) {
          const side = Math.ceil(Math.hypot(frameWidth, frameHeight));
          this.rememberCoverSize(el, parent);
          el.style.flex = "0 0 auto";
          el.style.maxWidth = "none";
          el.style.maxHeight = "none";
          el.style.width = `${side}px`;
          el.style.height = `${side}px`;
          el.style.marginLeft = `${Math.round((frameWidth - side) / 2)}px`;
          el.style.marginTop = `${Math.round((frameHeight - side) / 2)}px`;
        }
        el.style.transform = `rotate(${this.displayBearing}deg)`;
        this.map.invalidateSize({animate: false});
      }
      this.updateNorthControl(transition);
    }
  }

  private settleNorth(): void {
    if (this.map && this.bearing === 0) {
      const el = this.map.getContainer();
      el.style.transition = "none";
      el.style.transform = "none";
      this.restoreCoverSize(el, el.parentElement);
    }
  }

  private clearSettleTimer(): void {
    if (this.settleTimer) {
      clearTimeout(this.settleTimer);
      this.settleTimer = null;
    }
  }

  private rememberCoverSize(el: HTMLElement, parent: HTMLElement | null): void {
    if (!this.coverSize) {
      this.coverSize = {
        width: el.style.width,
        height: el.style.height,
        marginLeft: el.style.marginLeft,
        marginTop: el.style.marginTop,
        flex: el.style.flex,
        maxWidth: el.style.maxWidth,
        maxHeight: el.style.maxHeight,
        parentOverflow: parent?.style.overflow || "",
        parentPosition: parent?.style.position || ""
      };
      if (parent) {
        parent.classList.add(MAP_GESTURES_FRAME_CLASS);
        parent.style.overflow = "hidden";
        if (!getComputedStyle(parent).position || getComputedStyle(parent).position === "static") {
          parent.style.position = "relative";
        }
        const controls = el.querySelector(".leaflet-control-container");
        if (controls) {
          parent.appendChild(controls);
        }
      }
    }
  }

  private restoreCoverSize(el: HTMLElement, parent: HTMLElement | null): void {
    if (this.coverSize) {
      el.style.width = this.coverSize.width;
      el.style.height = this.coverSize.height;
      el.style.marginLeft = this.coverSize.marginLeft;
      el.style.marginTop = this.coverSize.marginTop;
      el.style.flex = this.coverSize.flex;
      el.style.maxWidth = this.coverSize.maxWidth;
      el.style.maxHeight = this.coverSize.maxHeight;
      if (parent) {
        parent.classList.remove(MAP_GESTURES_FRAME_CLASS);
        parent.style.overflow = this.coverSize.parentOverflow;
        parent.style.position = this.coverSize.parentPosition;
        const controls = parent.querySelector(":scope > .leaflet-control-container");
        if (controls) {
          el.appendChild(controls);
        }
      }
      this.coverSize = null;
      this.map?.invalidateSize({animate: false});
    }
  }

  private updateNorthControl(transition = 0): void {
    if (this.northButton) {
      this.northButton.style.transition = transition ? `transform ${transition}ms ease` : "none";
      this.northButton.style.transform = this.bearing === 0 && !transition ? "" : `rotate(${-this.displayBearing}deg)`;
      this.northButton.classList.toggle("is-rotated", Math.abs(this.bearing) > 1);
    }
  }

  private hookDragCorrection(): void {
    const draggable = this.leafletDraggable();
    if (draggable && draggable !== this.hookedDraggable) {
      this.unhookDragCorrection();
      draggable.on("predrag", this.correctDragOffset);
      this.hookedDraggable = draggable;
    }
  }

  private unhookDragCorrection(): void {
    if (this.hookedDraggable) {
      this.hookedDraggable.off("predrag", this.correctDragOffset);
      this.hookedDraggable = null;
    }
  }

  private leafletDraggable(): {
    on: (type: string, fn: () => void) => void;
    off: (type: string, fn: () => void) => void;
    _startPos?: {x: number; y: number};
    _newPos?: {x: number; y: number};
    _parentScale?: {x: number; y: number};
  } | null {
    const handler = this.map?.dragging as unknown as {
      _draggable?: {
        on: (type: string, fn: () => void) => void;
        off: (type: string, fn: () => void) => void;
        _startPos?: {x: number; y: number};
        _newPos?: {x: number; y: number};
        _parentScale?: {x: number; y: number};
      };
    } | undefined;
    return handler?._draggable || null;
  }

  private correctDragOffset = (): void => {
    const draggable = this.leafletDraggable();
    if (draggable && draggable._startPos && draggable._newPos && Math.abs(this.bearing) >= 1) {
      const parentScale = draggable._parentScale || {x: 1, y: 1};
      const screenX = (draggable._newPos.x - draggable._startPos.x) * (parentScale.x || 1);
      const screenY = (draggable._newPos.y - draggable._startPos.y) * (parentScale.y || 1);
      const local = screenDeltaToLocal(screenX, screenY, this.bearing, this.coverScale || 1);
      draggable._newPos = L.point(draggable._startPos.x + local.x, draggable._startPos.y + local.y);
    }
  };

  private containerPointFromClient(clientX: number, clientY: number): L.Point {
    if (!this.map) {
      return L.point(0, 0);
    } else {
      const el = this.map.getContainer();
      const rect = el.getBoundingClientRect();
      const dx = clientX - (rect.left + rect.width / 2);
      const dy = clientY - (rect.top + rect.height / 2);
      const radians = (-this.bearing * Math.PI) / 180;
      const scale = this.coverScale || 1;
      return L.point(
        el.clientWidth / 2 + (dx * Math.cos(radians) - dy * Math.sin(radians)) / scale,
        el.clientHeight / 2 + (dx * Math.sin(radians) + dy * Math.cos(radians)) / scale
      );
    }
  }
}
