import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../services/logger-factory.service";
import { UrlService } from "../services/url.service";
import { NavBarLocation, SystemConfig } from "../models/system.model";
import { Subscription } from "rxjs";
import { SystemConfigService } from "../services/system/system-config.service";
import { LoginPanelComponent } from "../login-panel/login-panel.component";
import { HeaderButtonsComponent } from "../header-buttons/header-buttons";

@Component({
    selector: "app-header-bar",
    template: `@if (isNavbarBelowLogo()) {
      <div class="bg-dark d-none d-lg-block">
        <div class="container">
          <div class="row p-2">
            <div class="d-block d-sm-flex align-items-center col-md-4">
              @if (systemConfig?.header?.headerBar?.showLoginLinksAndSiteEdit) {
                <app-login-panel/>
              }
            </div>
            <div
              class="d-block d-sm-flex align-items-center justify-content-center justify-content-lg-end col-md-8 order-sm-3 col-12 order-3">
              @if (systemConfig?.header?.headerBar?.showNavigationButtons) {
                <app-header-buttons/>
              }
            </div>
          </div>
        </div>
      </div>
    } @else {
      <div class="bg-dark d-none d-lg-block">
        <div class="container">
          <div class="row p-2">
            <div class="d-block d-sm-flex align-items-center col-md-4">
              @if (systemConfig?.header?.headerBar?.showLoginLinksAndSiteEdit) {
                <app-login-panel/>
              }
            </div>
            <div
              class="d-block d-sm-flex align-items-center justify-content-center justify-content-lg-end col-md-8 order-sm-3 col-12 order-3">
              @if (systemConfig?.header?.headerBar?.showNavigationButtons) {
                <app-header-buttons/>
              }
            </div>
          </div>
        </div>
      </div>
    }
    `,
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

  isNavbarBelowLogo(): boolean {
    return this.systemConfig?.header?.navBar?.location === NavBarLocation.BELOW_LOGO;
  }

}
