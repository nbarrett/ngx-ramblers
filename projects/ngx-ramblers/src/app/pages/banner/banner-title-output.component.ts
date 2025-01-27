import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { TitleLine } from "../../models/banner-configuration.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UrlService } from "../../services/url.service";
import { NgClass } from "@angular/common";

@Component({
    selector: "app-banner-title-output",
    styleUrls: ["./banner.component.sass"],
    template: `
      @if (titleLine.include) {
        <div class="title" [style.font-size.px]="titleLine.fontSize">
          <img class="text-icon" [ngClass]="{'none': !titleLine.showIcon}"
            [src]="urlService.imageSource(titleLine?.image?.awsFileName)"/>
          <span class="ml-2 {{titleLine.part1.class}}">{{titleLine.part1.value}}</span>
          <span class="ml-2 {{titleLine.part2.class}}">{{titleLine.part2.value}}</span>
          <span class="ml-2 {{titleLine.part3.class}}">{{titleLine.part3.value}}</span>
        </div>
      }
      `,
    imports: [NgClass]
})

export class BannerTitleOutputComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("BannerTitleOutputComponent", NgxLoggerLevel.ERROR);
  urlService = inject(UrlService);

  @Input()
  public titleLine: TitleLine;

  ngOnInit() {
    this.logger.debug("ngOnInit:titleLine:", this.titleLine);
  }

}


