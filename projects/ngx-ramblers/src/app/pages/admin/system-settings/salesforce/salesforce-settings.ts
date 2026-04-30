import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheckCircle, faPlug, faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { SalesforceConfig, SalesforceTestConnectionResult } from "../../../../models/salesforce.model";
import { InputSize } from "../../../../models/ui-size.model";
import { SecretInputComponent } from "../../../../modules/common/secret-input/secret-input.component";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { SalesforceConfigService } from "../../../../services/salesforce/salesforce-config.service";
import { SalesforceSyncService } from "../../../../services/salesforce/salesforce-sync.service";
import { SystemConfigService } from "../../../../services/system/system-config.service";

@Component({
  selector: "app-salesforce-settings",
  imports: [FormsModule, FontAwesomeModule, SecretInputComponent],
  template: `
    <div class="row thumbnail-heading-frame">
      <div class="thumbnail-heading">Salesforce Member API</div>
      <div class="col-sm-12">
        <p class="form-text text-muted mb-3">
          NGX-side integration with the Ramblers Salesforce member API. While the toggle is off, the system behaves
          exactly as it does today and no outbound calls are made. Turning it on enables the manual
          <em>Sync members from Salesforce</em> action on the Member Bulk Load page; the existing Insight Hub xlsx
          bulk-load route stays available either way.
        </p>
        <div class="form-check mb-3">
          <input id="salesforce-enabled"
                 type="checkbox"
                 class="form-check-input"
                 [(ngModel)]="config.enabled"
                 (ngModelChange)="pushLocal()">
          <label class="form-check-label" for="salesforce-enabled">Enable Salesforce member API</label>
        </div>
        <div class="form-check mb-3 ms-4">
          <input id="salesforce-granular-consent"
                 type="checkbox"
                 class="form-check-input"
                 [(ngModel)]="config.enableGranularConsent"
                 (ngModelChange)="pushLocal()"
                 [disabled]="!config.enabled">
          <label class="form-check-label" for="salesforce-granular-consent">
            Respect granular consent (group / area / other)
          </label>
          <small class="form-text text-muted d-block">
            Off (default): Insight Hub parity. Only <code>emailMarketingConsent</code> is read from Salesforce; the
            three group/area/other consent flags are ignored even if Salesforce returns them. The system behaves as
            it does today.<br>
            On: <code>groupMarketingConsent</code>, <code>areaMarketingConsent</code> and
            <code>otherMarketingConsent</code> are read from each member record and written to the local profile.
            Use this once HQ has committed the new consent fields, or when demonstrating the granular-consent mode.
          </small>
        </div>
        <div class="row">
          <div class="col-md-12">
            <div class="form-group">
              <label for="salesforce-endpoint">Endpoint base URL</label>
              <input id="salesforce-endpoint"
                     type="text"
                     class="form-control input-sm"
                     [(ngModel)]="config.endpointBaseUrl"
                     (ngModelChange)="pushLocal()"
                     placeholder="https://salesforce-api.example.org">
              <small class="form-text text-muted">No trailing slash. The client appends <code>/api/groups/&#123;groupCode&#125;/members</code>.</small>
            </div>
          </div>
        </div>
        <div class="form-group mb-3">
          <label>Auth tokens per group code</label>
          @if (availableGroupCodes.length === 0) {
            <div class="alert alert-warning">
              No group codes are configured under Area &amp; Group settings. Configure <code>group.groupCode</code> first
              (comma-separate when there is more than one, e.g. <code>KT50,KT06</code>), then return here to enter a token for each.
            </div>
          } @else {
            <small class="form-text text-muted d-block mb-2">
              Tokens are scoped per group code on the Salesforce side. Enter the token issued by HQ for each group, then Test that group on its own row.
              Full sync iterates across every group code automatically.
            </small>
            @for (code of availableGroupCodes; track code) {
              <div class="row mb-2 align-items-start">
                <div class="col-md-2 pt-1"><strong>{{ code }}</strong></div>
                <div class="col-md-8">
                  <app-secret-input
                    [id]="'salesforce-api-key-' + code"
                    [name]="'salesforce-api-key-' + code"
                    [ngModel]="config.apiKeysByGroupCode?.[code] ?? ''"
                    (ngModelChange)="setTokenFor(code, $event)"
                    [size]="InputSize.SM"
                    placeholder="Bearer token for {{ code }}">
                  </app-secret-input>
                </div>
                <div class="col-md-2">
                  <button type="button"
                          class="btn btn-primary btn-sm"
                          [disabled]="testingByCode[code] || !config.endpointBaseUrl || !(config.apiKeysByGroupCode?.[code])"
                          (click)="testConnectionFor(code)">
                    <fa-icon [icon]="faPlug" class="me-2"/>
                    {{ testingByCode[code] ? "Testing..." : "Test" }}
                  </button>
                </div>
              </div>
            }
          }
        </div>
        @if (config.lastSyncedAt) {
          <div class="mb-3">
            <strong>Last synced:</strong> {{ dateUtils.displayDateAndTime(config.lastSyncedAt) }}
            ({{ dateUtils.asDateTime(config.lastSyncedAt).toRelative() }})
            @if (config.lastSyncCursor) {
              <span class="text-muted ms-2">cursor: {{ dateUtils.displayDateAndTime(config.lastSyncCursor) }}</span>
            }
          </div>
        }
        @if (lastTestResult; as result) {
          @if (result.success) {
            <div class="alert alert-success">
              <fa-icon [icon]="faCheckCircle" class="me-2"/>
              <strong>Connected.</strong> HTTP {{ result.status }} in {{ result.latencyMs }}ms.
              @if (result.message) { {{ result.message }} }
            </div>
          } @else {
            <div class="alert alert-danger">
              <fa-icon [icon]="faTimesCircle" class="me-2"/>
              <strong>Connection failed.</strong>
              @if (result.errorCode) { {{ result.errorCode }} - }
              {{ result.message || "no further detail" }}
              @if (result.status) {
                (HTTP {{ result.status }})
              }
              @if (result.latencyMs !== undefined && result.latencyMs > 0) {
                in {{ result.latencyMs }}ms
              }.
            </div>
          }
        }
      </div>
    </div>
  `
})
export class SalesforceSettings implements OnInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("SalesforceSettings", NgxLoggerLevel.ERROR);
  private salesforceConfigService = inject(SalesforceConfigService);
  private salesforceSyncService = inject(SalesforceSyncService);
  private systemConfigService = inject(SystemConfigService);
  protected dateUtils = inject(DateUtilsService);

  protected readonly InputSize = InputSize;
  protected readonly faPlug = faPlug;
  protected readonly faCheckCircle = faCheckCircle;
  protected readonly faTimesCircle = faTimesCircle;

  config: SalesforceConfig = { endpointBaseUrl: null, apiKeysByGroupCode: {}, enabled: false };
  availableGroupCodes: string[] = [];
  testingByCode: Record<string, boolean> = {};
  lastTestResult: SalesforceTestConnectionResult | null = null;

  private subscriptions: Subscription[] = [];

  async ngOnInit() {
    await this.salesforceConfigService.refresh();
    this.subscriptions.push(this.salesforceConfigService.events().subscribe(value => {
      this.config = { ...value, apiKeysByGroupCode: { ...(value?.apiKeysByGroupCode ?? {}) } };
      this.logger.info("config received", this.config);
    }));
    this.subscriptions.push(this.systemConfigService.events().subscribe(item => {
      this.availableGroupCodes = (item?.group?.groupCode ?? "")
        .split(",")
        .map(code => code.trim())
        .filter(code => code.length > 0);
    }));
  }

  setTokenFor(groupCode: string, value: string): void {
    const next = { ...(this.config.apiKeysByGroupCode ?? {}) };
    if (value && value.length > 0) {
      next[groupCode] = value;
    } else {
      delete next[groupCode];
    }
    this.config = { ...this.config, apiKeysByGroupCode: next };
    this.pushLocal();
  }

  pushLocal(): void {
    this.salesforceConfigService.setLocal(this.config);
  }

  ngOnDestroy() {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  async testConnectionFor(groupCode: string) {
    this.testingByCode = { ...this.testingByCode, [groupCode]: true };
    this.lastTestResult = null;
    try {
      this.lastTestResult = await this.salesforceSyncService.testConnection(this.config, groupCode);
    } catch (error) {
      this.logger.error("testConnectionFor error", groupCode, error);
      this.lastTestResult = { success: false, errorCode: "REQUEST_FAILED", message: String(error) };
    } finally {
      this.testingByCode = { ...this.testingByCode, [groupCode]: false };
    }
  }

}
