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
    template: `
      <div class="w-100 {{systemConfig?.header?.navBar?.class}}">
        <div class="ramblers-list-{{systemConfig?.header?.navBar?.class}} d-flex justify-content-center justify-content-lg-end">
          <ul class="d-flex gap-2">
            <app-page-navigator/>
          </ul>
        </div>
        <div class="row mx-auto py-2 w-100 align-items-center justify-content-between bg-dark d-flex d-lg-none">
          <div
            class="d-block d-sm-flex align-items-center justify-content-center justify-content-lg-end order-sm-3 col-12 order-3">
            @if (systemConfig?.header?.headerBar?.showNavigationButtons) {
              <app-header-buttons/>
            }
          </div>
        </div>
      </div>
    `,
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
