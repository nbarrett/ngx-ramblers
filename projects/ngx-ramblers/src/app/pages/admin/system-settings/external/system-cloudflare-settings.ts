import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NonSensitiveCloudflareConfig } from "../../../../models/cloudflare-email-routing.model";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { CloudflareButton } from "../../../../modules/common/third-parties/cloudflare-button";

@Component({
  selector: "app-system-cloudflare-settings",
  imports: [FontAwesomeModule, CloudflareButton],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Cloudflare Email Routing</div>
      @if (configError) {
        <div class="col-sm-12">
          <div class="alert alert-warning">
            Cloudflare Email Routing is not configured for this environment.
            Contact the platform administrator to set up email routing.
          </div>
        </div>
      } @else {
        <div class="col-sm-12">
          <div class="row">
            <div class="col-md-6">
              <div class="form-group">
                <label>Base Domain</label>
                <input type="text" class="form-control input-sm" [value]="baseDomain" disabled>
                <small class="form-text text-muted">Domain for committee email addresses</small>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label>Account ID</label>
                <input type="text" class="form-control input-sm" [value]="accountId" disabled>
              </div>
            </div>
            <div class="col-md-6">
              <div class="form-group">
                <label>Zone ID</label>
                <div class="d-flex align-items-center gap-2">
                  <input type="text" class="form-control input-sm" [value]="zoneId" disabled>
                  @if (dashboardUrl) {
                    <app-cloudflare-button button title="Email Routing Dashboard"
                      (click)="openDashboard()"/>
                  }
                </div>
              </div>
            </div>
          </div>
          <small class="form-text text-muted">These settings are managed centrally and encrypted during deployment. Email routing rules are configured in Committee Settings.</small>
        </div>
      }
    </div>`
})
export class SystemCloudflareSettingsComponent implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("SystemCloudflareSettingsComponent", NgxLoggerLevel.ERROR);
  private cloudflareService = inject(CloudflareEmailRoutingService);
  private subscriptions: Subscription[] = [];

  baseDomain = "";
  accountId = "";
  zoneId = "";
  configError = false;
  protected readonly faExternalLinkAlt = faExternalLinkAlt;

  ngOnInit() {
    this.cloudflareService.queryCloudflareConfig()
      .catch(err => {
        this.logger.error("Cloudflare config not available:", err);
        this.configError = true;
      });
    this.subscriptions.push(
      this.cloudflareService.cloudflareConfigNotifications().subscribe((config: NonSensitiveCloudflareConfig) => {
        if (config) {
          this.baseDomain = config.baseDomain || "";
          this.accountId = config.accountId || "";
          this.zoneId = config.zoneId || "";
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  get dashboardUrl(): string {
    if (this.accountId && this.baseDomain) {
      return `https://dash.cloudflare.com/${this.accountId}/${this.baseDomain}/email/routing/overview`;
    }
    return null;
  }

  openDashboard() {
    if (this.dashboardUrl) {
      window.open(this.dashboardUrl, "_blank");
    }
  }
}
