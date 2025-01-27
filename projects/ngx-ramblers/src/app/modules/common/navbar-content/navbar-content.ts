import { Component, inject, OnDestroy, OnInit } from "@angular/core";
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

  private logger: Logger = inject(LoggerFactory).createLogger("NavbarContentComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  urlService = inject(UrlService);
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

