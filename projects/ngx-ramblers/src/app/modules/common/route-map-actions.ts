import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { DOCUMENT } from "@angular/common";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faEyeSlash, faStar } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";

@Component({
  selector: "app-route-map-actions",
  imports: [FontAwesomeModule, TooltipDirective],
  template: `
    <div class="route-map-actions">
      <button class="route-map-action route-map-favourite" type="button"
              [attr.aria-pressed]="favourite"
              [attr.aria-label]="favourite ? 'Remove from favourites' : 'Favourite'"
              [tooltip]="favourite ? 'Remove from favourites' : 'Favourite'"
              [isDisabled]="!tooltipsEnabled"
              #favouriteTooltip="bs-tooltip"
              container="body"
              (click)="favouriteTooltip.hide(); favouriteToggle.emit(); $event.stopPropagation()">
        <fa-icon [icon]="faStar"/>
      </button>
      @if (showHide) {
        <button class="route-map-action" type="button"
                aria-label="Hide" tooltip="Hide" container="body"
                [isDisabled]="!tooltipsEnabled" #hideTooltip="bs-tooltip"
                (click)="hideTooltip.hide(); hide.emit(); $event.stopPropagation()">
          <fa-icon [icon]="faEyeSlash"/>
        </button>
      }
      <ng-content/>
    </div>
  `,
  styles: [`
    :host
      position: absolute
      top: 2px
      left: 2px
      z-index: 2
      display: flex
      flex-direction: column
      align-items: flex-start
      gap: 0
      pointer-events: none

    .route-map-actions
      display: flex
      flex-direction: column
      align-items: flex-start
      pointer-events: auto

    .route-map-action
      display: inline-flex
      align-items: center
      justify-content: center
      width: 36px
      min-width: 36px
      height: 36px
      min-height: 36px
      padding: 0
      border: 0
      background: transparent
      color: #ffffff
      font-size: 0.95rem
      line-height: 1
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.75))

    .route-map-favourite[aria-pressed="true"]
      color: #f9b104
  `]
})
export class RouteMapActionsComponent {
  protected readonly tooltipsEnabled = !!inject(DOCUMENT).defaultView?.matchMedia?.("(hover: hover) and (pointer: fine)").matches;
  @Input() favourite = false;
  showHide = false;
  @Output() favouriteToggle = new EventEmitter<void>();
  @Output() hide = new EventEmitter<void>();
  faStar = faStar;
  faEyeSlash = faEyeSlash;

  @Input("showHide") set showHideValue(value: boolean) {
    this.showHide = coerceBooleanProperty(value);
  }
}
