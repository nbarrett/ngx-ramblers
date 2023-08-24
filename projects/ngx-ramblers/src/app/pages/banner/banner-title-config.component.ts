import { Component, Input, OnDestroy, OnInit } from "@angular/core";
import first from "lodash-es/first";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { TitleLine } from "../../models/banner-configuration.model";
import { Images, SystemConfig } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { SystemConfigService } from "../../services/system/system-config.service";

@Component({
  selector: "app-banner-title-config",
  styleUrls: ["./banner.component.sass"],
  template: `
    <h4>
      <div class="custom-control custom-checkbox">
        <input class="custom-control-input"
               [(ngModel)]="titleLine.include"
               type="checkbox"
               id="show-title-{{id}}">
        <label class="custom-control-label"
               for="show-title-{{id}}">Line {{id}}</label>
      </div>
    </h4>
    <div class="row">
      <div class="col-sm-6">
        <div class="custom-control custom-checkbox">
          <input class="custom-control-input"
                 [(ngModel)]="titleLine.showIcon" type="checkbox" id="show-icon-{{id}}">
          <label class="custom-control-label"
                 for="show-icon-{{id}}">Prefix with icon</label>
        </div>
        <app-icon-selector [titleLine]="titleLine" label="Prefix with icon"></app-icon-selector>
      </div>
      <div class="col-sm-6">
        <label>Font Size:</label>
        <input [(ngModel)]="titleLine.fontSize"
               type="number" class="form-control input-sm">
      </div>
    </div>
    <app-banner-title-part-config [titlePart]="titleLine.part1" id="1"></app-banner-title-part-config>
    <app-banner-title-part-config [titlePart]="titleLine.part2" id="2"></app-banner-title-part-config>
    <app-banner-title-part-config [titlePart]="titleLine.part3" id="3"></app-banner-title-part-config>
  `
})

export class BannerTitleConfigComponent implements OnInit, OnDestroy {
  private logger: Logger;
  @Input()
  public titleLine: TitleLine;
  @Input()
  public id: string;
  private icons: Images;
  private subscriptions: Subscription[] = [];

  constructor(loggerFactory: LoggerFactory,
              private systemConfigService: SystemConfigService) {
    this.logger = loggerFactory.createLogger(BannerTitleConfigComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");

    this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.icons = config.icons;
        this.logger.info("retrieved icons", this.icons);
        if (!this?.titleLine?.image && this.titleLine) {
          this.titleLine.image = first(this.icons.images);
        }
      });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}

