import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { Subscription } from "rxjs";
import { SystemConfig } from "../models/system.model";
import { SystemConfigService } from "../services/system/system-config.service";
import { NavigationEnd, Router } from "@angular/router";
import { AnalyticsService } from "../pages/admin/system-settings/google-analytics/analytics.service";

@Component({
  selector: "app-root",
  templateUrl: "./container.html",
  styleUrls: ["./container.sass"]
})
export class ContainerComponent implements OnInit, OnDestroy {
  public systemConfigService: SystemConfigService = inject(SystemConfigService);
  private router: Router = inject(Router);
  private analyticsService: AnalyticsService = inject(AnalyticsService);
  private subscriptions: Subscription[] = [];
  protected config: SystemConfig;

  ngOnInit() {
    this.subscriptions.push(this.systemConfigService.events()
      .subscribe((config: SystemConfig) => {
        this.config = config;
      }));
    this.subscriptions.push(this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.analyticsService.trackPageView(event.urlAfterRedirects);
      }
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }


}
