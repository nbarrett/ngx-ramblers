import { Component, Input } from "@angular/core";

@Component({
  selector: "app-map-loading-overlay",
  styles: [`
    .map-loading-overlay
      position: absolute
      inset: 0
      background: var(--map-loading-background, rgba(255, 255, 255, 0.85))
      color: var(--map-loading-colour, inherit)
      display: flex
      align-items: center
      justify-content: center
      border-radius: var(--radius-3)
      flex-direction: column
      gap: var(--space-4)
      padding: var(--space-6)
      text-align: center

    .map-loading-heading
      margin: 0
      font-size: 1.6rem
      font-weight: 700
      font-family: inherit
      color: inherit

    .map-loading-description
      margin: 0
      max-width: 26rem

    .map-loading-spinner
      color: var(--map-loading-accent, var(--bs-secondary))
  `],
  template: `
    <div class="map-loading-overlay" role="status" aria-live="polite">
      <div class="spinner-border map-loading-spinner">
        @if (!heading) {
          <span class="visually-hidden">Loading map…</span>
        }
      </div>
      @if (heading) {
        <h1 class="map-loading-heading">{{ heading }}</h1>
      }
      @if (description) {
        <p class="map-loading-description">{{ description }}</p>
      }
    </div>
  `
})
export class MapLoadingOverlay {
  @Input() heading: string | null = null;
  @Input() description: string | null = null;
}
