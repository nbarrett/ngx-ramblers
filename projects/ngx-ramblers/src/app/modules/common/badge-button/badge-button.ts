import { Component, Input } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { NumberUtilsService } from "../../../services/number-utils.service";
import { PageContentActionsService } from "../../../services/page-content-actions.service";
import { SiteEditService } from "../../../site-edit/site-edit.service";
import { IconDefinition } from "@fortawesome/fontawesome-common-types";

@Component({
  selector: "app-badge-button",
  template: `
    <div [ngClass]="disabled ? 'badge-button disabled' : 'badge-button'"
         delay=500 tooltip="{{caption}}">
      <fa-icon [icon]="icon"></fa-icon>
      <span>{{caption}}</span>
    </div>`
})

export class BadgeButtonComponent {

  @Input()
  public tooltip: string;
  @Input()
  public caption: string;
  @Input()
  public disabled: boolean;
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

