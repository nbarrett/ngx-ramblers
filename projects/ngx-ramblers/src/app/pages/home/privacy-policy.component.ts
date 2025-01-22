import { Component, OnInit } from "@angular/core";
import { UrlService } from "../../services/url.service";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";

@Component({
  selector: "app-privacy-policy-us",
  templateUrl: "./privacy-policy.component.html",
  standalone: false
})
export class PrivacyPolicyComponent implements OnInit {
  private logger: Logger;

  constructor(private urlService: UrlService, loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(PrivacyPolicyComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit() {
    this.logger.debug("ngOnInit");
  }

}
