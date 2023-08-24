import { Component, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { SystemConfig } from "../models/system.model";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { SystemConfigService } from "../services/system/system-config.service";
import { UrlService } from "../services/url.service";

@Component({
  selector: "app-header-buttons",
  templateUrl: "./header-buttons.html",
  styleUrls: ["./header-buttons.sass"]

})
export class HeaderButtonsComponent implements OnInit, OnDestroy {
  private logger: Logger;
  public systemConfigResponse: SystemConfig;
  private subscriptions: Subscription[] = [];

  constructor(private systemConfigService: SystemConfigService, loggerFactory: LoggerFactory, public urlService: UrlService) {
    this.logger = loggerFactory.createLogger("HeaderButtonsComponent", NgxLoggerLevel.OFF);
  }

  ngOnInit(): void {
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => {
      this.logger.info("received:", item);
      this.systemConfigResponse = item;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
