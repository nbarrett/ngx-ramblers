import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { AppShellService } from "../../services/maps/app-shell.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faDiamondTurnRight } from "@fortawesome/free-solid-svg-icons";
import { directionsLinks } from "../../functions/locate";
import { DirectionsApp, DirectionsLink } from "../../models/locate.model";

@Component({
  selector: "app-directions-pill",
  imports: [FontAwesomeModule],
  template: `
    <div class="control-pill" role="group" [attr.aria-label]="'Directions to ' + label">
      <span class="control-pill-text"><fa-icon [icon]="faDirections" class="me-1"/>Directions</span>
      @for (link of links; track link.app) {
        <span class="control-pill-divider"></span>
        @if (inlineApps.includes(link.app)) {
          <button type="button" class="control-pill-btn" [class.active]="shownApp === link.app" (click)="show.emit(link.app)" [title]="'Show ' + link.app + ' here on this page'">{{ link.app }}</button>
        } @else {
          <a class="control-pill-btn" [href]="link.url" target="_blank" rel="noopener" [title]="'Directions to ' + label + ' in ' + link.app + ' (opens in a new tab)'">{{ link.app }}</a>
        }
      }
    </div>`
})
export class DirectionsPill {
  @Input() latitude: number;
  @Input() longitude: number;
  @Input() label = "this point";
  @Input() inlineApps: DirectionsApp[] = [];
  @Input() shownApp: DirectionsApp | null = null;
  @Output() show = new EventEmitter<DirectionsApp>();
  private appShell = inject(AppShellService);
  protected readonly faDirections = faDiamondTurnRight;

  get links(): DirectionsLink[] {
    return this.latitude && this.longitude ? directionsLinks(this.latitude, this.longitude, this.appShell.platform()) : [];
  }
}
