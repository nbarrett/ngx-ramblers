import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { SystemConfig } from "../../../../models/system.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { AlertTarget } from "../../../../models/alert-target.model";

@Component({
  selector: "app-system-google-analytics-settings",
  template: `
    <div class="row img-thumbnail thumbnail-2">
      <div class="thumbnail-heading">Google Analytics</div>
      <div class="col-sm-12" *ngIf="systemConfigInternal?.googleAnalytics">
        <div class="row">
          <div class="col-sm-6">
            <div class="row">
              <div class="col-md-12">
                <div class="form-group">
                  <label for="site-key">Tracking Id</label>
                  <input [(ngModel)]="systemConfigInternal.googleAnalytics.trackingId"
                         id="site-key"
                         type="text" class="form-control input-sm"
                         placeholder="Enter Tracking Id">
                  <div *ngIf="!systemConfigInternal?.googleAnalytics?.trackingId" class="mt-1 small text-danger">
                    Tracking Id is required
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`,
})
export class SystemGoogleAnalyticsSettings implements OnInit, OnDestroy {

  protected systemConfigInternal: SystemConfig;
  loggerFactory: LoggerFactory = inject(LoggerFactory);
  systemConfigService: SystemConfigService = inject(SystemConfigService);
  public notifyTarget: AlertTarget = {};
  private logger = this.loggerFactory.createLogger("SystemGoogleAnalyticsSettings", NgxLoggerLevel.ERROR);

  @Input({
    alias: "config",
    required: true
  }) set configValue(systemConfig: SystemConfig) {
    this.handleConfigChange(systemConfig);
  }

  ngOnInit() {
    this.logger.info("constructed:", this.systemConfigInternal.googleAnalytics);
  }

  ngOnDestroy(): void {
    this.logger.info("ngOnDestroy");
  }

  handleConfigChange(systemConfig: SystemConfig) {
    this.systemConfigInternal = systemConfig;
    if (!this.systemConfigInternal?.googleAnalytics) {
      this.systemConfigInternal.googleAnalytics = this.systemConfigService.googleAnalyticsDefaults();
    }
    this.logger.info("handleConfigChange:googleAnalytics:", this.systemConfigInternal.googleAnalytics);
  }

}
