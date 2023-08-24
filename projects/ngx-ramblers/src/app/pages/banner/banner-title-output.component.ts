import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { TitleLine } from "../../models/banner-configuration.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { StringUtilsService } from "../../services/string-utils.service";
import { SystemConfigService } from "../../services/system/system-config.service";
import { UrlService } from "../../services/url.service";

@Component({
  selector: "app-banner-title-output",
  styleUrls: ["./banner.component.sass"],
  template: `
      <div *ngIf="titleLine.include" class="title" [style.font-size.px]="titleLine.fontSize">
          <img class="text-icon" [ngClass]="{'none': !titleLine.showIcon}"
               [src]="urlService.imageSource(titleLine?.image?.awsFileName)"/>
          <span class="ml-2 {{titleLine.part1.class}}">{{titleLine.part1.value}}</span>
          <span class="ml-2 {{titleLine.part2.class}}">{{titleLine.part2.value}}</span>
          <span class="ml-2 {{titleLine.part3.class}}">{{titleLine.part3.value}}</span>
      </div>
  `
})

export class BannerTitleOutputComponent implements OnInit {

  @Input()
  public titleLine: TitleLine;
  private logger: Logger;

  constructor(private stringUtils: StringUtilsService,
              public urlService: UrlService,
              private systemConfigService: SystemConfigService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(BannerTitleOutputComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:titleLine:", this.titleLine);
  }

}


