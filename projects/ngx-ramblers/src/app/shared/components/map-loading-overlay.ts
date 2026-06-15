import { Component } from "@angular/core";

@Component({
  selector: "app-map-loading-overlay",
  styles: [`
    .map-loading-overlay
      position: absolute
      inset: 0
      background: rgba(255, 255, 255, 0.85)
      display: flex
      align-items: center
      justify-content: center
      border-radius: 0.5rem
  `],
  template: `
    <div class="map-loading-overlay">
      <div class="spinner-border text-secondary" role="status">
        <span class="visually-hidden">Loading map…</span>
      </div>
    </div>
  `
})
export class MapLoadingOverlay {
}
