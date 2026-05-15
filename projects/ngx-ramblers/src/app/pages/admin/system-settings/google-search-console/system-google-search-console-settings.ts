import { Component, inject, Input } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { AlertComponent } from "ngx-bootstrap/alert";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { ALERT_SUCCESS } from "../../../../models/alert-target.model";
import { SystemConfig } from "../../../../models/system.model";
import { SystemConfigService } from "../../../../services/system/system-config.service";
import { extractGoogleSiteVerificationId } from "../../../../functions/google-search-console";

@Component({
  selector: "app-system-google-search-console-settings",
  imports: [FormsModule, AlertComponent, FontAwesomeModule],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Google Search Console</div>
      @if (systemConfigInternal?.googleSearchConsole) {
        <div class="col-sm-12">
          <p class="my-3">
            Verifies this site with Google Search Console using the HTML tag method, so no
            Cloudflare or DNS access is needed.
          </p>
          <p class="mb-3">
            In <a href="https://search.google.com/search-console/welcome" target="_blank"
            rel="noopener">Google Search Console</a>, on the property type screen choose the
            second option, URL prefix. In the address box enter this site's full address@if (siteUrl) {<span>: <code>{{ siteUrl }}</code></span>} @else {<span>, including the <code>https://</code> prefix</span>}.
            Google recommends the HTML file method - skip it. Under Other verification methods,
            expand HTML tag. Google shows a meta tag. Paste the whole tag into the Verification Id
            box below; NGX pulls out the <code>content</code> value automatically. The tag is then
            added to every page server-side. See
            <a href="https://support.google.com/webmasters/answer/9008080" target="_blank"
            rel="noopener">Google's verification guide</a> for the full steps.
          </p>
          <div class="row">
            <div class="col-md-6">
              <div class="form-group">
                <label for="gsc-verification-id">Verification Id</label>
                <input id="gsc-verification-id" type="text" class="form-control input-sm"
                       [(ngModel)]="verificationIdInput"
                       placeholder="paste the meta tag, or the id, from Google">
              </div>
            </div>
          </div>
          @if (verificationIdMessage) {
            <alert type="success" class="mt-2 mb-0">
              <fa-icon [icon]="ALERT_SUCCESS.icon"/>
              <span class="ms-2">{{ verificationIdMessage }}</span>
            </alert>
          }
        </div>
      }
    </div>`
})
export class SystemGoogleSearchConsoleSettings {

  private systemConfigService = inject(SystemConfigService);

  protected systemConfigInternal: SystemConfig;
  protected siteUrl: string;
  protected verificationIdMessage: string;
  protected readonly ALERT_SUCCESS = ALERT_SUCCESS;

  @Input({
    alias: "config",
    required: true
  }) set configValue(systemConfig: SystemConfig) {
    this.systemConfigInternal = systemConfig;
    if (!this.systemConfigInternal?.googleSearchConsole) {
      this.systemConfigInternal.googleSearchConsole = this.systemConfigService.googleSearchConsoleDefaults();
    }
    this.siteUrl = this.systemConfigInternal?.group?.href || null;
  }

  get verificationIdInput(): string {
    return this.systemConfigInternal?.googleSearchConsole?.verificationId;
  }

  set verificationIdInput(value: string) {
    if (!this.systemConfigInternal?.googleSearchConsole) {
      return;
    }
    const extracted = extractGoogleSiteVerificationId(value);
    this.systemConfigInternal.googleSearchConsole.verificationId = extracted;
    this.verificationIdMessage = value && extracted !== value.trim()
      ? `Verification Id ${extracted} was applied - ensure settings are saved.`
      : null;
  }
}
