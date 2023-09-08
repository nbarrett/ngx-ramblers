import { Component, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { PageService } from "../services/page.service";
import { StringUtilsService } from "../services/string-utils.service";
import { SystemConfigService } from "../services/system/system-config.service";
import isEmpty from "lodash-es/isEmpty";

@Component({
  selector: "app-page",
  templateUrl: "./page.component.html",
  styleUrls: ["./page.component.sass"]
})
export class PageComponent implements OnInit {

  public pageTitle: string;

  @Input("pageTitle") set acceptPageTitleChange(pageTitle: string) {
    this.logger.info("Input:pageTitle:", pageTitle);
    this.pageTitle = pageTitle;
    this.pageService.setTitle(pageTitle);
  }

  private logger: Logger;

  constructor(public pageService: PageService,
              private stringUtils: StringUtilsService,
              private systemConfigService: SystemConfigService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger("PageComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.info("ngOnInit:pageTitle:", this.pageTitle, "this.relativePages", this.pageService.relativePages(), "suppliedOrDefaultPageTitle:", this.suppliedOrDefaultPageTitle());
    this.pageService.setTitle(...this.pageService.relativePages().filter(item => !isEmpty(item?.href)).map(item => item?.title).concat(this.suppliedOrDefaultPageTitle()));
  }


  suppliedOrDefaultPageTitle() {
    this.logger.debug("suppliedOrDefaultPageTitle:pageTitle:", this.pageTitle, "pageSubtitle:", this.pageService.pageSubtitle());
    return this.pageTitle || this.pageService.pageSubtitle();
  }
}

