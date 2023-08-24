import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LogoAndTextLinesBanner } from "../../models/banner-configuration.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";

@Component({
  selector: "app-banner-logo-and-text-lines-output",
  styleUrls: ["./banner.component.sass"],
  template: `
    <div class="row mt-3" *ngIf="banner">
      <header>
        <div class="row d-flex align-items-center text-center">
          <div [class]="columnsLogo()" *ngIf="banner?.logo?.show">
            <app-banner-image [image]="banner?.logo?.image"></app-banner-image>
          </div>
          <div [class]="columnsHeading()">
            <app-banner-title-output [titleLine]="banner.line1"></app-banner-title-output>
            <app-banner-title-output [titleLine]="banner.line2"></app-banner-title-output>
          </div>
        </div>
      </header>
    </div>`
})

export class BannerLogoAndTextLinesOutputComponent implements OnInit {

  @Input() public banner: LogoAndTextLinesBanner;
  private logger: Logger;

  constructor(
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(BannerLogoAndTextLinesOutputComponent, NgxLoggerLevel.OFF);
  }

  columnsLogo(): string {
    return "col-sm-" + this.banner?.logo?.columns;
  }

  columnsHeading(): string {
    return `col-sm-${12 - this.banner?.logo?.columns}`;
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:logoAndTextLinesBanner:", this.banner);
  }

}
