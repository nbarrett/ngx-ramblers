import { inject, Injectable, NgZone } from "@angular/core";
import { LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import * as L from "leaflet";
import { DisplayedWalk } from "../../models/walk.model";

@Injectable({ providedIn: "root" })
export class MapPopupService {
  private zone = inject(NgZone);
  private logger = inject(LoggerFactory).createLogger("MapPopupService", NgxLoggerLevel.ERROR);
  private open: Array<{ popup: L.Popup, marker: L.Marker }> = [];
  private escAttached = false;

  bindPopup(marker: L.Marker, html: string, clickTargets: Array<{ id: string, walk: DisplayedWalk }>, onSelect: (dw: DisplayedWalk) => void, onOpenChange?: (count: number) => void): void {
    marker.bindPopup(html, { autoClose: false, closeOnClick: false, autoPan: false, keepInView: false });
    marker.on("popupopen", () => {
      this.zone.run(() => onOpenChange && onOpenChange(this.open.length + 1));
      setTimeout(() => {
        const root = marker.getPopup()?.getElement() as HTMLElement;
        if (root) {
          root.style.zIndex = "1000";
          const wrapper = root.querySelector(".leaflet-popup-content-wrapper") as HTMLElement;
          if (wrapper) wrapper.style.zIndex = "1000";
          const tip = root.querySelector(".leaflet-popup-tip") as HTMLElement;
          if (tip) tip.style.zIndex = "1000";
        }
        try { (L as any).DomEvent?.disableClickPropagation?.(root); } catch (error) { this.logger.debug("disableClickPropagation failed", error); }
        try { (L as any).DomEvent?.disableScrollPropagation?.(root); } catch (error) { this.logger.debug("disableScrollPropagation failed", error); }
        const opened = marker.getPopup();
        if (opened) {
          this.open = this.open.filter(r => r.popup !== opened).concat([{ popup: opened, marker }]);
          if (!this.escAttached) {
            document.addEventListener("keydown", this.onKeyDown, true);
            this.escAttached = true;
          }
        }
        for (const t of clickTargets) {
          const el = document.getElementById(t.id);
          if (el) {
            el.addEventListener("click", ev => {
              ev.preventDefault(); ev.stopPropagation(); try { (L as any).DomEvent?.stop?.(ev as any); } catch (error) { this.logger.debug("DomEvent.stop failed", error); }
              this.zone.run(() => onSelect(t.walk));
            });
          }
        }
      }, 50);
    });
    marker.on("popupclose", () => {
      this.zone.run(() => onOpenChange && onOpenChange(Math.max(0, this.open.length - 1)));
      const closed = marker.getPopup();
      if (closed) {
        this.open = this.open.filter(r => r.popup !== closed);
        if (this.open.length === 0 && this.escAttached) {
          document.removeEventListener("keydown", this.onKeyDown, true);
          this.escAttached = false;
        }
      }
    });
  }

  closeAll(): void {
    for (const r of this.open) {
      try { r.marker.closePopup(); } catch (error) { this.logger.debug("marker.closePopup failed", error); }
    }
    this.open = [];
  }

  private onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      if (this.open.length > 0) {
        const last = this.open[this.open.length - 1];
        try { last.marker.closePopup(); } catch (error) { this.logger.debug("last.marker.closePopup failed", error); }
        event.preventDefault();
        event.stopPropagation();
      }
    }
  }
}
