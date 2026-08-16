import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { SystemConfig } from "../models/system.model";
import { SystemConfigService } from "../services/system/system-config.service";
import { HeaderBarComponent } from "../header-bar/header-bar";
import { NavbarComponent } from "../modules/common/navbar/navbar";
import { RouterOutlet } from "@angular/router";
import { FooterComponent } from "../footer/footer";
import { DataPopulationService } from "../pages/admin/data-population.service";
import { VersionCheckService } from "../services/version-check.service";
import { CanonicalLinkService } from "../services/canonical-link.service";
import { AppShellService } from "../services/maps/app-shell.service";

@Component({
    selector: "app-root",
    template: `
    @if (!appShellActive) {
      @if (config?.header?.headerBar?.show) {
        <app-header-bar/>
      }
    }
    <div [class.app-shell]="appShellActive" [class.container]="!appShellActive">
      @if (!appShellActive) {
        <app-navbar/>
      }
      <router-outlet/>
    </div>
    @if (!appShellActive) {
      <app-footer/>
    }
    `,
    styleUrls: ["./container.sass"],
    imports: [HeaderBarComponent, NavbarComponent, RouterOutlet, FooterComponent]
})
export class ContainerComponent implements OnInit, OnDestroy {
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  private dataPopulationService = inject(DataPopulationService);
  private versionCheckService = inject(VersionCheckService);
  private canonicalLinkService = inject(CanonicalLinkService);
  protected appShell = inject(AppShellService);
  private subscriptions: Subscription[] = [];
  protected config: SystemConfig;
  protected appShellActive = false;

  ngOnInit() {
    this.dataPopulationService.clearLegacyLocalStorage();
    this.versionCheckService.initialise();
    this.canonicalLinkService.initialise();
    this.appShellActive = this.appShell.active();
    this.subscriptions.push(this.appShell.active$.subscribe(active => {
      this.appShellActive = active;
    }));
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
      }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }


}
