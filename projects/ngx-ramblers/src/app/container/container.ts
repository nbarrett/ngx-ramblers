import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { SystemConfig } from "../models/system.model";
import { SystemConfigService } from "../services/system/system-config.service";
import { HeaderBarComponent } from "../header-bar/header-bar";
import { NavbarComponent } from "../modules/common/navbar/navbar";
import { RouterOutlet } from "@angular/router";
import { FooterComponent } from "../footer/footer";
import { DataPopulationService } from "../pages/admin/data-population.service";

@Component({
    selector: "app-root",
    template: `
    <div class="container-fluid">
      @if (config?.header?.headerBar?.show) {
        <app-header-bar/>
      }
      <app-navbar/>
    </div>
    <div class="container">
      <router-outlet/>
    </div>
    <app-footer/>
    `,
    styleUrls: ["./container.sass"],
    imports: [HeaderBarComponent, NavbarComponent, RouterOutlet, FooterComponent]
})
export class ContainerComponent implements OnInit, OnDestroy {
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  private dataPopulationService = inject(DataPopulationService);
  private subscriptions: Subscription[] = [];
  protected config: SystemConfig;

  ngOnInit() {
    this.dataPopulationService.clearLegacyLocalStorage();
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }


}
