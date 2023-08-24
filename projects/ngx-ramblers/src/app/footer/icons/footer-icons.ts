import { Component, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { ExternalSystems } from "../../models/system.model";
import { Logger, LoggerFactory } from "../../services/logger-factory.service";
import { SystemConfigService } from "../../services/system/system-config.service";

@Component({
  selector: "app-footer-icons",
  templateUrl: "./footer-icons.html",
  styleUrls: ["./footer-icons.sass"]
})
export class FooterIconsComponent implements OnInit, OnDestroy {

  public externalSystems: ExternalSystems;
  private logger: Logger;
  private subscriptions: Subscription[] = [];

  constructor(private systemConfigService: SystemConfigService,
              loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.createLogger(FooterIconsComponent, NgxLoggerLevel.OFF);
  }

  ngOnInit(): void {
    this.logger.info("subscribing to systemConfigService events");
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => this.externalSystems = item.externalSystems));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
