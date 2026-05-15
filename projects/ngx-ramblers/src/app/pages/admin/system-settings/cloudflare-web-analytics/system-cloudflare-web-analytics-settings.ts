import { Component, inject, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { SystemConfig } from "../../../../models/system.model";
import { SystemConfigService } from "../../../../services/system/system-config.service";

@Component({
  selector: "app-system-cloudflare-web-analytics-settings",
  imports: [FormsModule],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Cloudflare Web Analytics</div>
      @if (systemConfigInternal?.cloudflareWebAnalytics) {
        <div class="col-sm-12">
          <p class="mb-3">
            Cookieless, PECR-compliant analytics from Cloudflare. The beacon is injected at app
            startup when enabled and a Beacon Token is present. Create the Web Analytics site in
            the Cloudflare dashboard, then paste its Beacon Token and Site Tag below.
          </p>
          <div class="row align-items-end">
            <div class="col-md-3">
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
            <div class="col-md-3">
              <div class="form-group">
                <label for="cf-wa-host">Host</label>
                <input id="cf-wa-host" type="text" class="form-control input-sm"
                       [(ngModel)]="systemConfigInternal.cloudflareWebAnalytics.host"
                       placeholder="e.g. www.example.org.uk">
              </div>
            </div>
            <div class="col-md-3">
              <div class="form-group">
                <label for="cf-wa-site-token">Beacon Token</label>
                <input id="cf-wa-site-token" type="text" class="form-control input-sm"
                       [(ngModel)]="systemConfigInternal.cloudflareWebAnalytics.siteToken"
                       placeholder="data-cf-beacon token">
              </div>
            </div>
            <div class="col-md-3">
              <div class="form-group">
                <label for="cf-wa-site-tag">Site Tag</label>
                <input id="cf-wa-site-tag" type="text" class="form-control input-sm"
                       [(ngModel)]="systemConfigInternal.cloudflareWebAnalytics.siteTag"
                       placeholder="RUM site tag (for dashboard)">
              </div>
            </div>
          </div>
        </div>
      }
    </div>`
})
export class SystemCloudflareWebAnalyticsSettings {

  private systemConfigService = inject(SystemConfigService);

  protected systemConfigInternal: SystemConfig;

  @Input({
    alias: "config",
    required: true
  }) set configValue(systemConfig: SystemConfig) {
    this.systemConfigInternal = systemConfig;
    if (!this.systemConfigInternal?.cloudflareWebAnalytics) {
      this.systemConfigInternal.cloudflareWebAnalytics = this.systemConfigService.cloudflareWebAnalyticsDefaults();
    }
    if (!this.systemConfigInternal.cloudflareWebAnalytics.host) {
      this.systemConfigInternal.cloudflareWebAnalytics.host = this.derivedHost();
    }
  }

  private derivedHost(): string {
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
