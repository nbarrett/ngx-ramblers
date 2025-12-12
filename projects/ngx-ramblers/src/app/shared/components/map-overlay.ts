import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";

@Component({
  selector: "app-map-overlay",
  template: `
    @if (allowToggle || allowWaypointsToggle) {
      <div class="map-overlay top-right" [style.top]="showControls ? '20px' : '8px'">
        <div class="overlay-content">
          <div class="d-flex flex-column gap-2">
            @if (allowToggle) {
              <button type="button" class="badge bg-warning text-dark border-0" (click)="onToggleMapControls()">
                <fa-icon [icon]="showControls ? faEyeSlash : faEye"></fa-icon>
                <span class="ms-1">{{ showControls ? 'Hide map options' : 'Show map options' }}</span>
              </button>
            }
            @if (allowWaypointsToggle) {
              <button type="button" class="badge bg-info text-white border-0" (click)="onToggleWaypoints()">
                <fa-icon [icon]="showWaypoints ? faEyeSlash : faEye"/>
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
  private logger: Logger = inject(LoggerFactory).createLogger("MapOverlay", NgxLoggerLevel.ERROR);
  protected readonly faEye = faEye;
  protected readonly faEyeSlash = faEyeSlash;

  onToggleMapControls() {
    if (!this.allowToggle) {
      this.logger.info("toggleControls not being emitted as allowToggle:" + this.allowToggle);
    } else {
      this.logger.info("toggleControls not being emitted as showControls:" + this.showControls);
      this.toggleControls.emit();
    }
  }

  onToggleWaypoints() {
    if (!this.allowWaypointsToggle) {
      this.logger.info("toggleWaypoints not being emitted as allowWaypointsToggle:" + this.allowWaypointsToggle);
    } else {
      this.logger.info("toggleWaypoints: " + this.allowWaypointsToggle, "emitting", this.showWaypoints);
      this.toggleWaypoints.emit();
    }
  }
}
