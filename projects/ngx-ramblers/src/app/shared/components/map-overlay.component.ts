import { Component, Input, Output, EventEmitter } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";

@Component({
  selector: "app-map-overlay",
  template: `
    <div class="map-overlay top-right" [style.top]="showControls ? '20px' : '8px'">
      <div class="overlay-content">
        <div class="d-flex flex-column gap-2">
          <button type="button" class="badge bg-warning text-dark border-0" (click)="onToggleControls()">
            <fa-icon [icon]="showControls ? faEyeSlash : faEye"></fa-icon>
            <span class="ms-1">{{ showControls ? 'Hide map options' : 'Show map options' }}</span>
          </button>
          <ng-content select="[slot=additional-buttons]"></ng-content>
        </div>
      </div>
    </div>
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
export class MapOverlayComponent {
  @Input() showControls = true;
  @Output() toggleControls = new EventEmitter<void>();

  protected readonly faEye = faEye;
  protected readonly faEyeSlash = faEyeSlash;

  onToggleControls() {
    this.toggleControls.emit();
  }
}