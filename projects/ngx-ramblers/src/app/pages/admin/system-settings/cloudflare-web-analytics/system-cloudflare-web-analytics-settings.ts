import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { SystemConfig } from "../../../../models/system.model";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { CloudflareWebAnalyticsService } from "../../../../services/cloudflare/cloudflare-web-analytics.service";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { CloudflareUrlService } from "../../../../services/cloudflare/cloudflare-url.service";
import { CloudflareRumSite } from "../../../../models/cloudflare-web-analytics.model";
import { NonSensitiveCloudflareConfig } from "../../../../models/cloudflare-email-routing.model";
import { AlertTarget } from "../../../../models/alert-target.model";
import { AlertInstance, NotifierService } from "../../../../services/notifier.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { extractErrorMessage } from "../../../../functions/strings";
import { CloudflareButton } from "../../../../modules/common/third-parties/cloudflare-button";

@Component({
  selector: "app-system-cloudflare-web-analytics-settings",
  imports: [FormsModule, CloudflareButton, FontAwesomeModule],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Cloudflare Web Analytics</div>
      @if (systemConfigInternal?.cloudflareWebAnalytics) {
        <div class="col-sm-12">
          <p class="mb-3">
            Cookieless, PECR-compliant analytics from Cloudflare. The beacon is injected at app
            startup when enabled and a Beacon Token is present. Create the Web Analytics site
            below, or open the Cloudflare dashboard to manage it.
          </p>
          <div class="row align-items-end">
            <div class="col-md-4">
              <div class="form-group">
                <label class="d-block">Enabled</label>
                <div class="form-check form-switch">
                  <input type="checkbox" role="switch" class="form-check-input"
                         id="cf-wa-enabled"
                         [(ngModel)]="systemConfigInternal.cloudflareWebAnalytics.enabled">
                  <label class="form-check-label" for="cf-wa-enabled">
                    {{ systemConfigInternal.cloudflareWebAnalytics.enabled ? "Beacon active" : "Beacon disabled" }}
                  </label>
                </div>
              </div>
            </div>
            <div class="col-md-4">
              <div class="form-group">
                <label for="cf-wa-site-token">Beacon Token</label>
                <input id="cf-wa-site-token" type="text" class="form-control input-sm"
                       [(ngModel)]="systemConfigInternal.cloudflareWebAnalytics.siteToken"
                       placeholder="data-cf-beacon token">
              </div>
            </div>
            <div class="col-md-4">
              <div class="form-group">
                <label for="cf-wa-site-tag">Site Tag</label>
                <input id="cf-wa-site-tag" type="text" class="form-control input-sm"
                       [(ngModel)]="systemConfigInternal.cloudflareWebAnalytics.siteTag"
                       placeholder="RUM site tag (for dashboard)">
              </div>
            </div>
          </div>
          <div class="row mt-2">
            <div class="col-md-8">
              <div class="form-group">
                <label for="cf-wa-host">Host</label>
                <input id="cf-wa-host" type="text" class="form-control input-sm"
                       [(ngModel)]="host"
                       placeholder="e.g. www.example.org.uk">
                <small class="form-text text-muted">Hostname for a new Web Analytics site</small>
              </div>
            </div>
          </div>
          <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
            <button type="button" class="btn btn-primary"
                    [disabled]="busy || !host?.trim() || !!systemConfigInternal.cloudflareWebAnalytics.siteTag"
                    (click)="createSite()">
              {{ busy ? "Working..." : "Create site" }}
            </button>
            @if (dashboardUrl) {
              <app-cloudflare-button button title="Web Analytics Dashboard"
                                     (click)="openDashboard()"/>
            }
            @if (siteUrl) {
              <app-cloudflare-button button title="Manage site"
                                     (click)="openSite()"/>
            }
          </div>
          @if (notifyTarget.showAlert) {
            <div class="alert {{ notifyTarget.alert.class }} mt-2">
              <fa-icon [icon]="notifyTarget.alert.icon"></fa-icon>
              @if (notifyTarget.alertTitle) {
                <strong class="ms-2">{{ notifyTarget.alertTitle }}: </strong>
              }
              {{ notifyTarget.alertMessage }}
            </div>
          }
        </div>
      }
    </div>`
})
export class SystemCloudflareWebAnalyticsSettings implements OnInit, OnDestroy {

  private systemConfigService = inject(SystemConfigService);
  private cloudflareService = inject(CloudflareWebAnalyticsService);
  private cloudflareConfigService = inject(CloudflareEmailRoutingService);
  private cloudflareUrl = inject(CloudflareUrlService);
  private notifierService = inject(NotifierService);
  private logger: Logger = inject(LoggerFactory).createLogger("SystemCloudflareWebAnalyticsSettings", NgxLoggerLevel.ERROR);
  private subscriptions: Subscription[] = [];

  protected systemConfigInternal: SystemConfig;
  protected host: string | null = null;
  protected accountId = "";
  protected busy = false;
  protected notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

  @Input({
    alias: "config",
    required: true
  }) set configValue(systemConfig: SystemConfig) {
    this.systemConfigInternal = systemConfig;
    if (!this.systemConfigInternal?.cloudflareWebAnalytics) {
      this.systemConfigInternal.cloudflareWebAnalytics = this.systemConfigService.cloudflareWebAnalyticsDefaults();
    }
    if (!this.host) {
      this.host = this.derivedHost();
    }
  }

  ngOnInit() {
    this.cloudflareConfigService.queryCloudflareConfig().catch(err => this.logger.info("Cloudflare config not available:", err));
    this.subscriptions.push(
      this.cloudflareConfigService.cloudflareConfigNotifications().subscribe((config: NonSensitiveCloudflareConfig) => {
        if (config) {
          this.accountId = config.accountId || "";
        }
      })
    );
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async createSite(): Promise<void> {
    const host = (this.host || "").trim();
    if (!host) {
      this.notify.warning({
        title: "Host required",
        message: "A host is required to create a Web Analytics site."
      });
      return;
    }
    this.busy = true;
    this.notify.hide();
    try {
      const site = await this.cloudflareService.createSite({host, autoInstall: false});
      this.applySite(site);
      this.notify.success({
        title: "Web Analytics site created",
        message: `Site created for ${host}. Beacon Token and Site Tag have been filled in - remember to Save.`
      });
    } catch (err) {
      this.logger.error("Failed to create Web Analytics site:", err);
      this.notify.error({
        title: "Web Analytics site creation failed",
        message: extractErrorMessage(err)
      });
    } finally {
      this.busy = false;
    }
  }

  get dashboardUrl(): string | null {
    return this.accountId ? this.cloudflareUrl.webAnalyticsSites(this.accountId) : null;
  }

  get siteUrl(): string | null {
    const siteTag = this.systemConfigInternal?.cloudflareWebAnalytics?.siteTag;
    return this.accountId && siteTag ? this.cloudflareUrl.webAnalyticsSite(this.accountId, siteTag) : null;
  }

  openDashboard(): void {
    if (this.dashboardUrl) {
      window.open(this.dashboardUrl, "_blank");
    }
  }

  openSite(): void {
    if (this.siteUrl) {
      window.open(this.siteUrl, "_blank");
    }
  }

  private applySite(site: CloudflareRumSite): void {
    this.systemConfigInternal.cloudflareWebAnalytics.siteToken = site.site_token;
    this.systemConfigInternal.cloudflareWebAnalytics.siteTag = site.site_tag;
  }

  private derivedHost(): string | null {
    const href = this.systemConfigInternal?.group?.href;
    if (!href) {
      return null;
    }
    try {
      return new URL(href).hostname;
    } catch {
      return null;
    }
  }
}
