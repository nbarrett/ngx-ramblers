import { Component, inject, Input, OnDestroy, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { CloudflareWebAnalyticsService } from "../../../services/cloudflare/cloudflare-web-analytics.service";
import { CloudflareEmailRoutingService } from "../../../services/cloudflare/cloudflare-email-routing.service";
import { CloudflareUrlService } from "../../../services/cloudflare/cloudflare-url.service";
import { CloudflareRumSite } from "../../../models/cloudflare-web-analytics.model";
import { NonSensitiveCloudflareConfig } from "../../../models/cloudflare-email-routing.model";
import { AlertTarget } from "../../../models/alert-target.model";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { extractErrorMessage } from "../../../functions/strings";
import { CloudflareButton } from "../../../modules/common/third-parties/cloudflare-button";

@Component({
  selector: "app-environment-web-analytics-sites",
  imports: [CloudflareButton, FontAwesomeModule],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Cloudflare Web Analytics Sites</div>
      <div class="col-sm-12">
        <p class="mb-3">
          Create the Cloudflare Web Analytics site for this environment. After it is created,
          paste its Beacon Token and Site Tag into the environment's System Settings.
        </p>
        @if (existingSiteTag) {
          <p class="text-muted mb-3">
            This environment already has a Web Analytics site (Site Tag {{ existingSiteTag }}).
          </p>
        }
        <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
          <button type="button" class="btn btn-primary"
                  [disabled]="busy || !host || !!existingSiteTag"
                  (click)="createSite()">
            {{ busy ? "Working..." : "Create site" }}
          </button>
          @if (existingSiteTag && accountId) {
            <app-cloudflare-button button title="Manage site"
                                   (click)="openSiteTag(existingSiteTag)"/>
          }
          @if (dashboardUrl) {
            <app-cloudflare-button button title="Web Analytics Dashboard"
                                   (click)="openDashboard()"/>
          }
        </div>
        @if (createdSites.length > 0) {
          <table class="table table-sm align-middle">
            <thead>
              <tr>
                <th>Host</th>
                <th>Site Tag</th>
                <th>Beacon Token</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (site of createdSites; track site.site_tag) {
                <tr>
                  <td>{{ siteHost(site) }}</td>
                  <td>{{ site.site_tag }}</td>
                  <td>{{ site.site_token }}</td>
                  <td>
                    <app-cloudflare-button button title="Manage site"
                                           (click)="openSiteTag(site.site_tag)"/>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        }
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
    </div>`
})
export class EnvironmentWebAnalyticsSites implements OnInit, OnDestroy {

  private cloudflareService = inject(CloudflareWebAnalyticsService);
  private cloudflareConfigService = inject(CloudflareEmailRoutingService);
  private cloudflareUrl = inject(CloudflareUrlService);
  private notifierService = inject(NotifierService);
  private logger: Logger = inject(LoggerFactory).createLogger("EnvironmentWebAnalyticsSites", NgxLoggerLevel.ERROR);
  private subscriptions: Subscription[] = [];

  protected createdSites: CloudflareRumSite[] = [];
  @Input() host: string | null = null;
  @Input() existingSiteTag: string | null = null;
  protected accountId = "";
  protected busy = false;
  protected notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);

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
      this.createdSites.unshift(site);
      this.notify.success({
        title: "Web Analytics site created",
        message: `Site created for ${host}. Copy the Site Tag and Beacon Token below into the environment's System Settings.`
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

  siteHost(site: CloudflareRumSite): string {
    return site.host || site.rules?.[0]?.host || site.ruleset?.zone_name || site.site_tag;
  }

  get dashboardUrl(): string | null {
    return this.accountId ? this.cloudflareUrl.webAnalyticsSites(this.accountId) : null;
  }

  openDashboard(): void {
    if (this.dashboardUrl) {
      window.open(this.dashboardUrl, "_blank");
    }
  }

  openSiteTag(siteTag: string): void {
    if (this.accountId) {
      window.open(this.cloudflareUrl.webAnalyticsSite(this.accountId, siteTag), "_blank");
    }
  }
}
