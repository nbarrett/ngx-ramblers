import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { BannerTextItem } from "../../models/banner-configuration.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";

@Component({
  selector: "app-banner-title-part-config",
  styleUrls: ["./banner.component.sass"],
  template: `
    <div class="row" *ngIf="titlePart">
      <div class="col-sm-6">
        <label class="mr-2" for="{{id}}-include">Part {{id}}:</label>
        <input id="{{id}}-include" type="text" [(ngModel)]="titlePart.value" class="form-control mr-2">
      </div>
      <div class="col-sm-6">
        <app-colour-selector [itemWithClassOrColour]="titlePart"/>
      </div>
    </div>`,
  standalone: false
})

export class BannerTitlePartConfigComponent implements OnInit {
  private logger: Logger;

  @Input()
  public titlePart: BannerTextItem;
  @Input()
  public id: string;

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(BannerTitlePartConfigComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
  }

}

