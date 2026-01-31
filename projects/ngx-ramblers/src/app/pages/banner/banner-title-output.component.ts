import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { ensureTitleLine, TitleLine } from "../../models/banner-configuration.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { UrlService } from "../../services/url.service";
import { NgClass } from "@angular/common";

@Component({
    selector: "app-banner-title-output",
    styleUrls: ["./banner.component.sass"],
    template: `
      @if (titleLine?.include) {
        <div class="title" [style.font-size.px]="titleLine.fontSize">
          @if (titleLine.showIcon && titleLine?.image?.awsFileName) {
            <img class="text-icon"
              [src]="urlService.imageSource(titleLine.image.awsFileName)"/>
          }
          <span class="ms-2 {{titleLine.part1.class}}">{{titleLine.part1.value}}</span>
          <span class="ms-2 {{titleLine.part2.class}}">{{titleLine.part2.value}}</span>
          <span class="ms-2 {{titleLine.part3.class}}">{{titleLine.part3.value}}</span>
        </div>
      }
      `,
    imports: [NgClass]
})

export class BannerTitleOutputComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger("BannerTitleOutputComponent", NgxLoggerLevel.ERROR);
  urlService = inject(UrlService);

  private titleLineValue: TitleLine = ensureTitleLine(null);
  @Input()
  set titleLine(value: TitleLine) {
    this.titleLineValue = ensureTitleLine(value || null);
  }
  get titleLine(): TitleLine {
    return this.titleLineValue;
  }

  ngOnInit() {
    this.logger.debug("ngOnInit:titleLine:", this.titleLine);
  }

}
