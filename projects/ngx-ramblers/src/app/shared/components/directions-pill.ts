import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { faApple, faGoogle, faWaze } from "@fortawesome/free-brands-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { AppShellService } from "../../services/maps/app-shell.service";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faDiamondTurnRight } from "@fortawesome/free-solid-svg-icons";
import { directionsLinks } from "../../functions/locate";
import { DirectionsApp, DirectionsLink } from "../../models/locate.model";

@Component({
  selector: "app-directions-pill",
  imports: [FontAwesomeModule, TooltipDirective],
  template: `
    @if (compact) {
      <div class="d-flex flex-wrap align-items-center gap-2" role="group" [attr.aria-label]="'Directions to ' + label">
        @for (link of links; track link.app) {
          @if (inlineApps.includes(link.app)) {
            <button type="button" class="btn btn-quiet btn-icon" [class.btn-primary]="shownApp === link.app" [tooltip]="'Show ' + link.app" [attr.aria-label]="'Show ' + link.app" (click)="show.emit(link.app)"><fa-icon [icon]="appIcons[link.app]"/></button>
          } @else {
            <a class="btn btn-quiet btn-icon" [href]="link.url" target="_blank" rel="noopener" [tooltip]="'Directions in ' + link.app" [attr.aria-label]="'Directions in ' + link.app"><fa-icon [icon]="appIcons[link.app]"/></a>
          }
        }
        <ng-content select="[compact-directions]"/>
      </div>
    } @else {
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
      <ng-content/>
    </div>
    }
    <ng-content select="[driving-origin]"/>`
})
export class DirectionsPill {
  @Input() latitude: number;
  @Input() longitude: number;
  @Input() label = "this point";
  @Input() compact = false;
  @Input() inlineApps: DirectionsApp[] = [];
  @Input() shownApp: DirectionsApp | null = null;
  @Output() show = new EventEmitter<DirectionsApp>();
  private appShell = inject(AppShellService);
  protected readonly faDirections = faDiamondTurnRight;
  protected readonly appIcons = {[DirectionsApp.GOOGLE_MAPS]: faGoogle, [DirectionsApp.APPLE_MAPS]: faApple, [DirectionsApp.WAZE]: faWaze};

  get links(): DirectionsLink[] {
    return Number.isFinite(this.latitude) && Number.isFinite(this.longitude) ? directionsLinks(this.latitude, this.longitude, this.appShell.platform()) : [];
  }
}
