import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { SystemConfig } from "../../../../models/system.model";
import { LoggerFactory } from "../../../../services/logger-factory.service";
import { NgxLoggerLevel } from "ngx-logger";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { AlertTarget } from "../../../../models/alert-target.model";
import { FormsModule } from "@angular/forms";

@Component({
    selector: "app-system-google-analytics-settings",
    template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Google Analytics</div>
      @if (systemConfigInternal?.googleAnalytics) {
        <div class="col-sm-12">
          <div class="row">
            <div class="col-sm-6">
              <div class="row">
                <div class="col-md-12">
                  <div class="form-group">
                    <label for="tracking-key">Tracking Id</label>
                    <input [(ngModel)]="systemConfigInternal.googleAnalytics.trackingId"
                           id="tracking-key"
                      type="text" class="form-control input-sm"
                      placeholder="Enter Tracking Id">
                    @if (!systemConfigInternal?.googleAnalytics?.trackingId) {
                      <div class="mt-1 small text-danger">
                        Tracking Id is required
                      </div>
                    }
                  </div>
                </div>
              </div>
            </div>
            <div class="col-sm-6">
              <div class="form-group">
                The Tracking Id (Google now calls it a Measurement Id) identifies this site to Google Analytics. It
                looks like <code>G-XXXXXXXXXX</code> and is found in your Google Analytics property under
                <strong>Admin &rarr; Data streams</strong>.
              </div>
              <div class="form-group">
                Leave it empty to turn Google Analytics off for this site: no tracking script is loaded and no
                analytics cookies are set.
              </div>
              <div>
                For what this means for your privacy policy and cookie notice, see
                <a href="/how-to/technical-articles/2026-04-04-privacy-cookies-and-compliance"
                   target="_blank">Privacy, cookies and compliance</a>. To create a property or find an existing
                Tracking Id, visit
                <a href="https://analytics.google.com" target="_blank">Google Analytics</a>.
              </div>
            </div>
          </div>
        </div>
      }
    </div>`,
    imports: [FormsModule]
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
