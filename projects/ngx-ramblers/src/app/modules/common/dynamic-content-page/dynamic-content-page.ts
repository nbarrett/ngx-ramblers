import { Component } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-dynamic-content-page",
  templateUrl: "./dynamic-content-page.html",
  styleUrls: ["./dynamic-content-page.sass"],
  standalone: false
})
export class DynamicContentPageComponent {
  private logger: Logger;

  constructor(
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(DynamicContentPageComponent, NgxLoggerLevel.OFF);
  }

}
