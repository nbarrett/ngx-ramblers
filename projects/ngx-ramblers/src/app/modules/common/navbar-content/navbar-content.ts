import { Component, OnDestroy, OnInit } from "@angular/core";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { UrlService } from "../../../services/url.service";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfig } from "../../../models/system.model";
import { Subscription } from "rxjs";
import { PageNavigatorComponent } from "../../../page-navigator/page-navigator.component";
import { HeaderButtonsComponent } from "../../../header-buttons/header-buttons";

@Component({
    selector: "app-navbar-content",
    templateUrl: "./navbar-content.html",
    styleUrls: ["./navbar-content.sass"],
    imports: [PageNavigatorComponent, HeaderButtonsComponent]
})
export class NavbarContentComponent  implements OnInit, OnDestroy {

  constructor(private systemConfigService: SystemConfigService,
              loggerFactory: LoggerFactory, public urlService: UrlService) {
    this.logger = loggerFactory.createLogger("NavbarContentComponent", NgxLoggerLevel.OFF);
  }

  private logger: Logger;
  public systemConfig: SystemConfig;
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.logger.info("NavbarContentComponent created");
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.systemConfig = systemConfig;
      this.logger.info("received:", systemConfig);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}

