import { Component, Input, Output, EventEmitter } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-map-overlay",
  template: `
    @if (allowToggle || allowWaypointsToggle) {
      <div class="map-overlay top-right" [style.top]="showControls ? '20px' : '8px'">
        <div class="overlay-content">
          <div class="d-flex flex-column gap-2">
            @if (allowToggle) {
              <button type="button" class="badge bg-warning text-dark border-0" (click)="onToggleControls()">
                <fa-icon [icon]="showControls ? faEyeSlash : faEye"></fa-icon>
                <span class="ms-1">{{ showControls ? 'Hide map options' : 'Show map options' }}</span>
              </button>
            }
            @if (allowWaypointsToggle) {
              <button type="button" class="badge bg-info text-white border-0" (click)="onToggleWaypoints()">
                <fa-icon [icon]="showWaypoints ? faEyeSlash : faEye"></fa-icon>
                <span class="ms-1">{{ showWaypoints ? 'Hide waypoints' : 'Show waypoints' }}</span>
              </button>
            }
            <ng-content select="[slot=additional-buttons]"></ng-content>
          </div>
        </div>
      </div>
    }
    <ng-content select="[slot=bottom-overlay]"></ng-content>
  `,
  styles: [`
    .map-overlay
      position: absolute
      z-index: 600
      pointer-events: auto

    .map-overlay.top-right
      top: 8px
      right: 8px

    .map-overlay.bottom-right
      bottom: 8px
      right: 8px
  `],
  imports: [FontAwesomeModule]
})
export class MapOverlay {
  @Input() showControls = true;
  @Input() allowToggle = true;
  @Input() showWaypoints = true;
  @Input() allowWaypointsToggle = true;
  @Output() toggleControls = new EventEmitter<void>();
  @Output() toggleWaypoints = new EventEmitter<void>();

  protected readonly faEye = faEye;
  protected readonly faEyeSlash = faEyeSlash;

  onToggleControls() {
    if (!this.allowToggle) {
      return;
    }
    this.toggleControls.emit();
  }

  onToggleWaypoints() {
    if (!this.allowWaypointsToggle) {
      return;
    }
    this.toggleWaypoints.emit();
  }
}
