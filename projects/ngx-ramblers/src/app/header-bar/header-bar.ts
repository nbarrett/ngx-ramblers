import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { UrlService } from "../services/url.service";
import { SystemConfig } from "../models/system.model";
import { Subscription } from "rxjs";
import { SystemConfigService } from "../services/system/system-config.service";
import { LoginPanelComponent } from "../login-panel/login-panel.component";
import { HeaderButtonsComponent } from "../header-buttons/header-buttons";

@Component({
    selector: "app-header-bar",
    templateUrl: "./header-bar.html",
    styleUrls: ["./header-bar.sass"],
    imports: [LoginPanelComponent, HeaderButtonsComponent]
})
export class HeaderBarComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("HeaderBarComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  urlService = inject(UrlService);
  public systemConfig: SystemConfig;
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.logger.info("HeaderBar created");
    this.subscriptions.push(this.systemConfigService.events().subscribe(systemConfig => {
      this.systemConfig = systemConfig;
      this.logger.info("received:", systemConfig);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

}
