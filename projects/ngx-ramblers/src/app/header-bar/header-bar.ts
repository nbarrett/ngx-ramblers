import { Component, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { UrlService } from "../services/url.service";

@Component({
  selector: "app-header-bar",
  templateUrl: "./header-bar.html",
  styleUrls: ["./header-bar.sass"]

})
export class HeaderBarComponent implements OnInit {
  private logger: Logger;

  constructor(loggerFactory: LoggerFactory, public urlService: UrlService) {
    this.logger = loggerFactory.createLogger(HeaderBarComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit(): void {
    this.logger.info("HeaderBar created");
  }

}
