import { Component } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { PageComponent } from "../../../page/page.component";
import { DynamicContentComponent } from "../dynamic-content/dynamic-content";

@Component({
    selector: "app-dynamic-content-page",
    templateUrl: "./dynamic-content-page.html",
    styleUrls: ["./dynamic-content-page.sass"],
    imports: [PageComponent, DynamicContentComponent]
})
export class DynamicContentPageComponent {
  private logger: Logger;

  constructor(
    loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(DynamicContentPageComponent, NgxLoggerLevel.OFF);
  }

}
