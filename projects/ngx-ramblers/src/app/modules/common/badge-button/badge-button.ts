import { Component, Input } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

@Component({
  selector: "app-badge-button,[app-badge-button]",
  template: `
      <div [ngClass]="{'badge-button': !inline, 'inline-button':inline, 'disabled' : disabled,
              'mr-0': noRightMargin, 'badge-button-active': active, 'w-100': fullWidth, 'float-right': alignRight}"
              delay=500 tooltip="{{tooltip? null: caption}}" [ngStyle]="{'height.px': height}">
          <fa-icon *ngIf="!iconPositionRight" [icon]="icon"></fa-icon>
          <span *ngIf="caption">{{caption}}</span>
          <ng-content/>
          <fa-icon class="ml-2" *ngIf="iconPositionRight" [icon]="icon"></fa-icon>
      </div>`,
  standalone: false
})

export class BadgeButtonComponent {

  @Input() public tooltip: string;
  @Input() public caption: string;
  @Input() public height: number;

  @Input("iconPositionRight") set iconPositionRightValue(value: boolean) {
    this.iconPositionRight = coerceBooleanProperty(value);
  }

  @Input("alignRight") set alignRightValue(value: boolean) {
    this.alignRight = coerceBooleanProperty(value);
  }

  @Input("disabled") set disabledValue(value: boolean) {
    this.disabled = coerceBooleanProperty(value);
  }

  @Input("noRightMargin") set noRightMarginValue(value: boolean) {
    this.noRightMargin = coerceBooleanProperty(value);
  }

  @Input("inline") set inlineValue(value: boolean) {
    this.inline = coerceBooleanProperty(value);
  }

  @Input("fullWidth") set fullwidthValue(value: boolean) {
    this.fullWidth = coerceBooleanProperty(value);
  }

  @Input("active") set activeValue(value: boolean) {
    this.active = coerceBooleanProperty(value);
  }

  @Input() public icon: IconDefinition;

  public alignRight: boolean;
  public disabled: boolean;
  public active: boolean;
  public noRightMargin: boolean;
  public fullWidth: boolean;
  public inline: boolean;
  public iconPositionRight: boolean;
  private logger: Logger;

  constructor(loggerFactory: LoggerFactory,
              public siteEditService: SiteEditService,
              public actions: PageContentActionsService) {
    this.logger = loggerFactory.createLogger("BadgeButtonComponent", NgxLoggerLevel.OFF);
  }

}

