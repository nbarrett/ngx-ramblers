import { Component, Input } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";
import { coerceBooleanProperty } from "@angular/cdk/coercion";

@Component({
  selector: "app-badge-button",
  template: `
      <div [ngClass]="{'badge-button': !inline, 'inline-button':inline, 'disabled' : disabled, 'mr-0': noRightMargin, 'badge-button-active': active, 'w-100': fullWidth}"
           delay=500 tooltip="{{tooltip? null: caption}}">
          <fa-icon [icon]="icon"></fa-icon>
          <span>{{caption}}</span>
      </div>`
})

export class BadgeButtonComponent {

  public disabled: boolean;
  public active: boolean;
  public noRightMargin: boolean;
  public fullWidth: boolean;
  public inline: boolean;

  @Input()
  public tooltip: string;
  @Input()
  public caption: string;


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

  @Input()
  public icon: IconDefinition;
  private logger: Logger;

  constructor(loggerFactory: LoggerFactory,
              public siteEditService: SiteEditService,
              private numberUtils: NumberUtilsService,
              public actions: PageContentActionsService) {
    this.logger = loggerFactory.createLogger("BadgeButtonComponent", NgxLoggerLevel.OFF);
  }


}

