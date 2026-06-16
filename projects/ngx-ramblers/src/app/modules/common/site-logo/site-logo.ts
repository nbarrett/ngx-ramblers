import { CommonModule } from "@angular/common";
import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { Image, SystemConfig } from "../../../models/system.model";
import { SystemConfigService } from "../../../services/system/system-config.service";
import { UrlService } from "../../../services/url.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";

@Component({
  selector: "app-site-logo",
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (logo?.awsFileName) {
      <img [src]="urlService.resourceRelativePathForAWSFileName(logo.awsFileName)"
           [alt]="systemConfig?.group?.shortName ?? 'Site logo'" [style.height.px]="height">
    }`
})
export class SiteLogoComponent implements OnInit, OnDestroy {

  @Input() height = 30;
  private logger: Logger = inject(LoggerFactory).createLogger("SiteLogoComponent", NgxLoggerLevel.ERROR);
  private systemConfigService = inject(SystemConfigService);
  protected urlService = inject(UrlService);
  public systemConfig: SystemConfig;
  public logo: Image;
  private subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.subscriptions.push(this.systemConfigService.events().subscribe((systemConfig: SystemConfig) => {
      this.systemConfig = systemConfig;
      this.logo = systemConfig?.logos?.images?.find(image => image.originalFileName === systemConfig?.header?.selectedLogo);
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }
}
