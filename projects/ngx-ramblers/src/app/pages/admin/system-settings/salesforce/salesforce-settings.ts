import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheckCircle, faExternalLinkAlt, faPlug, faTimesCircle } from "@fortawesome/free-solid-svg-icons";
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
      <div class="thumbnail-heading">Ramblers Team Emails</div>
      <div class="col-sm-12">
        <p class="form-text text-muted mb-3">
          Connection to the Ramblers Team Emails member and volunteer API. While the toggle is off, no outbound
          calls are made. Turning it on enables <em>Sync supporters now</em> on Member Bulk Load → Ramblers Team
          Emails; the existing Insight Hub xlsx bulk-load route stays available either way.
        </p>
        <div class="form-check mb-3">
          <input id="ramblers-team-emails-enabled"
                 type="checkbox"
                 class="form-check-input"
                 [(ngModel)]="config.enabled"
                 (ngModelChange)="pushLocal()">
          <label class="form-check-label" for="ramblers-team-emails-enabled">Enable Ramblers Team Emails</label>
        </div>
        <div class="row">
          <div class="col-md-12">
            <div class="form-group">
              <label for="ramblers-team-emails-endpoint">Endpoint base URL</label>
              <div class="input-group">
                <input id="ramblers-team-emails-endpoint"
                       type="text"
                       class="form-control input-sm"
                       [(ngModel)]="config.endpointBaseUrl"
                       (ngModelChange)="pushLocal()"
                       placeholder="https://api.example.org">
                @if (configuredEndpointUrl()) {
                  <button type="button"
                          class="btn btn-quiet btn-text"
                          title="Open endpoint"
                          (click)="openEndpoint()">
                    <fa-icon [icon]="faExternalLinkAlt"/>
                    Open
                  </button>
                }
              </div>
              <small class="form-text text-muted">No trailing slash. The client calls <code>/get_supporters</code>.</small>
            </div>
          </div>
        </div>
        <div class="form-group mb-3">
          <label>API keys per team code</label>
          @if (availableGroupCodes.length === 0) {
            <div class="alert alert-warning">
              No group codes are configured under Area &amp; Group settings. Configure <code>group.groupCode</code> first
              (comma-separate when there is more than one, e.g. <code>KT50,KT06</code>), then return here to enter a token for each.
            </div>
          } @else {
            <small class="form-text text-muted d-block mb-2">
              API keys are scoped to one team. Enter the key issued by Head Office for each team, then test that team on its own row.
              A supporter snapshot iterates across every configured team code automatically.
            </small>
            @for (code of availableGroupCodes; track code) {
              <div class="d-flex gap-2 align-items-center mb-2">
                <strong class="flex-shrink-0" style="min-width: 4rem">{{ code }}</strong>
                <div class="input-group flex-grow-1">
                  <app-secret-input
                    [id]="'ramblers-team-emails-api-key-' + code"
                    [name]="'ramblers-team-emails-api-key-' + code"
                    [ngModel]="config.apiKeysByGroupCode?.[code] ?? ''"
                    (ngModelChange)="setTokenFor(code, $event)"
                    [size]="InputSize.SM"
                    placeholder="API key for {{ code }}">
                  </app-secret-input>
                  <button type="button"
                          class="btn btn-quiet btn-text"
                          [disabled]="testingByCode[code] || !config.endpointBaseUrl || !(config.apiKeysByGroupCode?.[code])"
                          (click)="testConnectionFor(code)">
                    <fa-icon [icon]="faPlug"/>
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
  protected readonly faExternalLinkAlt = faExternalLinkAlt;

  config: SalesforceConfig = { endpointBaseUrl: null, apiKeysByGroupCode: {}, enabled: false };
  availableGroupCodes: string[] = [];
  testingByCode: Record<string, boolean> = {};
  lastTestResult: SalesforceTestConnectionResult | null = null;

  private subscriptions: Subscription[] = [];

  configuredEndpointUrl(): string | null {
    const value = this.config.endpointBaseUrl?.trim();
    return value ? value.replace(/\/+$/, "") : null;
  }

  openEndpoint(): void {
    const endpointUrl = this.configuredEndpointUrl();
    if (endpointUrl) {
      window.open(endpointUrl, "_blank", "noopener,noreferrer");
    }
  }

  async ngOnInit() {
    await this.salesforceConfigService.refresh();
    this.subscriptions.push(this.salesforceConfigService.events().subscribe(value => {
      this.config = { ...value, apiKeysByGroupCode: { ...(value?.apiKeysByGroupCode ?? {}) } };
      this.logger.info("config received", { enabled: this.config.enabled, endpointBaseUrl: this.config.endpointBaseUrl });
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
