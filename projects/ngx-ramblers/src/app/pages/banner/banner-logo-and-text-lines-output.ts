import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { LogoAndTextLinesBanner } from "../../models/banner-configuration.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { BannerHeadLogoComponent } from "./banner-logo/banner-logo";
import { BannerTitleOutputComponent } from "./banner-title-output.component";

@Component({
    selector: "app-banner-logo-and-text-lines-output",
    styleUrls: ["./banner.component.sass"],
    template: `
    @if (banner) {
      <div class="d-flex align-items-center text-center header-panel">
        @if (banner?.logo?.show) {
          <div [class]="columnsLogo()">
            <app-banner-image [image]="banner?.logo?.image"></app-banner-image>
          </div>
        }
        <div [class]="columnsHeading()">
          <app-banner-title-output [titleLine]="banner.line1"></app-banner-title-output>
          <app-banner-title-output [titleLine]="banner.line2"></app-banner-title-output>
        </div>
      </div>
    }
    `,
    imports: [BannerHeadLogoComponent, BannerTitleOutputComponent]
})

export class BannerLogoAndTextLinesOutputComponent implements OnInit {

  @Input() public banner: LogoAndTextLinesBanner;
  private logger: Logger;

  constructor(
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(BannerLogoAndTextLinesOutputComponent, NgxLoggerLevel.OFF);
  }

  columnsLogo(): string {
    return `col-sm-${this.banner?.logo?.columns} px-0`
  }

  columnsHeading(): string {
    return `col-sm-${12 - this.banner?.logo?.columns} px-0`;
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:logoAndTextLinesBanner:", this.banner);
  }

}
