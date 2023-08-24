import { Component, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { PageService } from "../../services/page.service";

@Component({
  selector: "app-join-us",
  templateUrl: "./join-us.component.html"
})
export class JoinUsComponent implements OnInit {
  private logger: Logger;

  constructor(private pageService: PageService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(JoinUsComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
    this.pageService.setTitle();
  }

}
