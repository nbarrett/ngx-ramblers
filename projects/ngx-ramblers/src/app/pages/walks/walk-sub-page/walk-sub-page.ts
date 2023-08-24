import { Component } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-walk-sub-page",
  templateUrl: "./walk-sub-page.html"
})
export class WalkSubPageComponent {
  private logger: Logger;

  constructor(
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(WalkSubPageComponent, NgxLoggerLevel.OFF);
  }

}
