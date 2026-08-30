import { Component, EventEmitter, inject, Input, Output, ViewChild } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import {
  faCircleCheck,
  faCircleExclamation,
  faEraser,
  faExclamationTriangle,
  faGlobe,
  faHouse,
  faRedo,
  faSpinner,
  faTrash,
  faUnlink,
  faWrench
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { CustomDomainEntry, CustomDomainStatus } from "../../../models/environment-config.model";
import {
  EnvironmentStatus,
  ExistingEnvironment,
  HostnameHealthReport,
  HostnameOrigin,
  HostnameSituation,
  HostnameSituationAlert,
  HostnameStatus
} from "../../../models/environment-setup.model";
import { SortDirection } from "../../../models/sort.model";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { StoredValue } from "../../../models/ui-actions";
import { LoggerFactory } from "../../../services/logger-factory.service";
import { AlertInstance, NotifierService } from "../../../services/notifier.service";
import { EnvironmentSetupService } from "../../../services/environment-setup/environment-setup.service";
import { AlertTarget } from "../../../models/alert-target.model";
import { SortableTableCellDirective } from "../sortable-table/sortable-table-cell.directive";
import { SortableTableComponent } from "../sortable-table/sortable-table.component";
import { SortableTableColumn, SortableTableSortState } from "../sortable-table/sortable-table.model";
import {
  canRepairRedirect,
  canUseAsSiteUrl,
  hostnameActionStatement,
  hostnameDnsProviderBadgeClass,
  hostnameDnsProviderOurs,
  hostnameDnsProviderShown,
  hostnameDnsSummary,
  hostnameHasActions,
  hostnameHealthBadgeClass,
  hostnameHealthLabel,
  hostnameHttpsSummary,
  hostnameOriginLabel,
  isEnvironmentSubdomainHost,
  shouldOfferClearSiteUrl
} from "./environment-hostname-display";
import { analyseHostnameSituation } from "../../../functions/hostname-situation";
import { environmentOperationErrorDetail } from "./environment-operation-error";
import { EnvironmentCustomDomains } from "./environment-custom-domains";

@Component({
  selector: "app-environment-hostnames",
  imports: [
    FontAwesomeModule,
    TooltipDirective,
    SortableTableComponent,
    SortableTableCellDirective,
    EnvironmentCustomDomains
  ],
  styles: [`
    :host
      display: block

    :host ::ng-deep .fa-icon-globe
      color: var(--ramblers-colour-mintcake)

    :host ::ng-deep .hostname-state-detail
      line-height: 1.35

    :host ::ng-deep .sortable-table-card
      overflow-x: auto

    :host ::ng-deep .sortable-table td
      word-break: normal
      overflow-wrap: break-word
  `],
  template: `
    <div class="row thumbnail-heading-frame mt-3">
      <div class="thumbnail-heading">Hostnames</div>
      <div class="col-12">
        <div class="d-flex align-items-start justify-content-between gap-2 flex-wrap mb-2">
          <p class="small text-muted mb-0">
            Live check of every address for this environment. The Site URL is the public address stored on the group.
            The free host is <code>{{ environmentSubdomainHint() }}</code>; create it with
            <strong>Setup subdomain</strong> under Steps to run, not with the boxes below.
            Remove it from the matching row in the table.
          </p>
          <button class="btn btn-quiet"
                  (click)="refresh()"
                  [disabled]="loadingHostnameHealth || operationBusy || customDomainsBusy()">
            @if (loadingHostnameHealth) {
              <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>
            } @else {
              <fa-icon [icon]="faRedo" class="me-1"></fa-icon>
            }
            Re-check
          </button>
        </div>
        @if (situation(); as outcome) {
          <div class="alert {{ outcome.alert }}">
            <div class="d-flex align-items-start">
              <fa-icon [icon]="outcome.alert === HostnameSituationAlert.SUCCESS ? faCircleCheck : faCircleExclamation"
                       class="me-2 mt-1"></fa-icon>
              <div>
                <strong>{{ outcome.title }}</strong>
                <div class="mt-1">{{ outcome.detail }}</div>
                @if (outcome.action) {
                  <div class="mt-2">{{ outcome.action }}</div>
                }
              </div>
            </div>
          </div>
        }
        @if (loadingHostnameHealth) {
          <div class="small text-muted">Checking hostnames…</div>
        } @else if (hostnameHealthError) {
          <p class="small text-danger mb-0">
            Hostname check did not complete: {{ hostnameHealthError }}. Press Re-check to try again.
          </p>
        } @else {
          <app-sortable-table
            [columns]="hostnameColumns"
            [rows]="hostnameStatuses()"
            [defaultSortKey]="hostnameSortKey"
            [defaultSortDirection]="hostnameSortDirection"
            [trackBy]="trackHostname"
            (sortChange)="onHostnameSortChange($event)"
            emptyMessage="No hostnames could be resolved for this environment.">
            <ng-template appSortableTableCell="hostname" let-row>
              <fa-icon [icon]="faGlobe" class="me-2 fa-icon-globe"></fa-icon>
              <a [href]="'https://' + row.hostname" target="_blank">{{ row.hostname }}</a>
            </ng-template>
            <ng-template appSortableTableCell="role" let-row>
              {{ originLabel(row) }}
            </ng-template>
            <ng-template appSortableTableCell="state" let-row>
              <div>
                <span [class]="healthBadgeClass(row)">{{ healthLabel(row) }}</span>
              </div>
              <div class="small text-muted mt-1 hostname-state-detail">{{ dnsSummary(row) }}</div>
              @if (dnsProviderShown(row) && !dnsProviderOurs(row)) {
                <div class="mt-1">
                  <span class="badge" [class]="dnsProviderBadgeClass(row)">{{ row.dnsProviderLabel }}</span>
                  <span class="small text-muted ms-2">not Cloudflare</span>
                </div>
              }
              @if (httpsSummary(row)) {
                <div class="small text-muted hostname-state-detail">{{ httpsSummary(row) }}</div>
              }
            </ng-template>
            <ng-template appSortableTableCell="action" let-row>
              <div class="small">{{ actionStatement(row) }}</div>
              @if (hasActions(row)) {
                <div class="d-inline-flex gap-1 mt-2">
                  @if (repairRedirect(row)) {
                    <button class="btn btn-primary btn-icon"
                            (click)="repairApexRedirect(row)"
                            [disabled]="customDomainsBusy() || operationBusy || siteUrlBusy"
                            tooltip="Repair redirect"
                            container="body"
                            aria-label="Repair redirect">
                      @if (customDomainsPanel?.apexRedirectBusy) {
                        <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
                      } @else {
                        <fa-icon [icon]="faWrench"></fa-icon>
                      }
                    </button>
                  }
                  @if (offerClearSiteUrl(row)) {
                    <button class="btn btn-quiet btn-icon"
                            (click)="clearSiteUrl()"
                            [disabled]="siteUrlBusy || operationBusy || customDomainsBusy()"
                            tooltip="Clear Site URL"
                            container="body"
                            aria-label="Clear Site URL">
                      @if (siteUrlBusy) {
                        <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
                      } @else {
                        <fa-icon [icon]="faEraser"></fa-icon>
                      }
                    </button>
                  }
                  @if (useAsSiteUrl(row)) {
                    <button class="btn btn-quiet btn-icon"
                            (click)="setSiteUrlFromHostname(row)"
                            [disabled]="siteUrlBusy || operationBusy || customDomainsBusy()"
                            tooltip="Use as Site URL"
                            container="body"
                            aria-label="Use as Site URL">
                      @if (siteUrlBusy) {
                        <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
                      } @else {
                        <fa-icon [icon]="faHouse"></fa-icon>
                      }
                    </button>
                  }
                  @if (row.redirectRuleTarget && !repairRedirect(row)) {
                    <button class="btn btn-quiet btn-icon"
                            (click)="removeApexRedirect(row)"
                            [disabled]="customDomainsBusy() || operationBusy || siteUrlBusy"
                            tooltip="Remove redirect"
                            container="body"
                            aria-label="Remove redirect">
                      @if (customDomainsPanel?.apexRedirectBusy) {
                        <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
                      } @else {
                        <fa-icon [icon]="faUnlink"></fa-icon>
                      }
                    </button>
                  }
                  @if (canRemoveEnvironmentSubdomainHost(row)) {
                    <button class="btn btn-danger btn-icon"
                            (click)="requestRemoveNgxSubdomain()"
                            [disabled]="operationBusy || customDomainsBusy() || removingNgxSubdomain || removeNgxSubdomainConfirming"
                            tooltip="Remove subdomain"
                            container="body"
                            aria-label="Remove subdomain">
                      @if (removingNgxSubdomain) {
                        <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
                      } @else {
                        <fa-icon [icon]="faTrash"></fa-icon>
                      }
                    </button>
                  }
                </div>
              }
            </ng-template>
          </app-sortable-table>
        }
        @if (removeNgxSubdomainConfirming) {
          <div class="alert alert-warning d-flex align-items-start mt-3 mb-0">
            <fa-icon [icon]="faExclamationTriangle" class="me-2 mt-1"/>
            <div class="flex-grow-1">
              <div><strong>Remove {{ environmentSubdomainHint() }}?</strong></div>
              <div class="small mt-1">{{ ngxSubdomainRemovalWarning() }}</div>
            </div>
            <div class="btn-group btn-group-sm ms-3">
              <button type="button" class="btn btn-danger" [disabled]="removingNgxSubdomain"
                      (click)="confirmRemoveNgxSubdomain()">Remove</button>
              <button type="button" class="btn btn-quiet"
                      (click)="cancelRemoveNgxSubdomain()">Cancel</button>
            </div>
          </div>
        }

        @if (environment) {
          <app-environment-custom-domains
            [environment]="environment"
            [environments]="environments"
            [hostnameHealthReport]="hostnameHealthReport"
            [operationBusy]="operationBusy || siteUrlBusy || removingNgxSubdomain"
            (environmentChanged)="onCustomDomainsChanged()"/>
        }
        @if (notifyTarget.showAlert) {
          <div class="alert {{ notifyTarget.alert.class }} mt-3 mb-0">
            <div class="d-flex align-items-start">
              <fa-icon [icon]="notifyTarget.alert.icon" class="me-2 mt-1"></fa-icon>
              <div>
                @if (notifyTarget.alertTitle) {
                  <strong>{{ notifyTarget.alertTitle }}</strong>
                  <div class="mt-1">{{ notifyTarget.alertMessage }}</div>
                } @else {
                  {{ notifyTarget.alertMessage }}
                }
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `
})
export class EnvironmentHostnames {
  private logger = inject(LoggerFactory).createLogger("EnvironmentHostnames", NgxLoggerLevel.ERROR);
  private notifierService = inject(NotifierService);
  private environmentSetupService = inject(EnvironmentSetupService);
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  notifyTarget: AlertTarget = {};
  private notify: AlertInstance = this.notifierService.createAlertInstance(this.notifyTarget);
  @ViewChild(EnvironmentCustomDomains) customDomainsPanel: EnvironmentCustomDomains | null = null;

  environment: ExistingEnvironment | null = null;
  @Input("environment") set environmentValue(env: ExistingEnvironment | null) {
    this.environment = env;
    if (env) {
      void this.probeHostnameHealth(env.name);
    } else {
      this.hostnameHealthReport = null;
    }
  }
  @Input() environments: ExistingEnvironment[] = [];
  @Input() envStatus: EnvironmentStatus | null = null;
  @Input() operationBusy = false;
  @Output() environmentChanged = new EventEmitter<void>();

  siteUrlBusy = false;
  hostnameHealthReport: HostnameHealthReport | null = null;
  hostnameHealthError: string | null = null;
  loadingHostnameHealth = false;
  removingNgxSubdomain = false;
  removeNgxSubdomainConfirming = false;
  hostnameSortKey = "healthy";
  hostnameSortDirection = ASCENDING;
  hostnameColumns: SortableTableColumn<HostnameStatus>[] = [
    {key: "hostname", label: "Hostname", sortKey: "hostname", cellClass: "nowrap"},
    {key: "role", label: "Role", sortKey: "origin", cellClass: "nowrap"},
    {key: "state", label: "State", sortKey: "healthy"},
    {key: "action", label: "What to do"}
  ];
  protected readonly HostnameSituationAlert = HostnameSituationAlert;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faEraser = faEraser;
  protected readonly faExclamationTriangle = faExclamationTriangle;
  protected readonly faGlobe = faGlobe;
  protected readonly faHouse = faHouse;
  protected readonly faRedo = faRedo;
  protected readonly faSpinner = faSpinner;
  protected readonly faTrash = faTrash;
  protected readonly faUnlink = faUnlink;
  protected readonly faWrench = faWrench;

  constructor() {
    const params = this.activatedRoute.snapshot.queryParams;
    this.hostnameSortKey = params[StoredValue.HOSTNAME_SORT] || "healthy";
    this.hostnameSortDirection = params[StoredValue.HOSTNAME_SORT_ORDER] === SortDirection.DESC ? DESCENDING : ASCENDING;
  }

  async refresh(): Promise<void> {
    if (this.environment) {
      await this.probeHostnameHealth(this.environment.name);
    }
  }

  hostnameStatuses(): HostnameStatus[] {
    return this.hostnameHealthReport?.hostnames || [];
  }

  situation(): HostnameSituation | null {
    const hostnames = this.hostnameStatuses();
    if (this.loadingHostnameHealth || this.hostnameHealthError || hostnames.length === 0) {
      return null;
    } else {
      return analyseHostnameSituation(hostnames);
    }
  }

  customDomains(): CustomDomainEntry[] {
    return this.environment?.customDomains || [];
  }

  customDomainsBusy(): boolean {
    return !!this.customDomainsPanel?.busy;
  }

  trackHostname = (_index: number, row: HostnameStatus): string => row.hostname;
  healthBadgeClass = hostnameHealthBadgeClass;
  healthLabel = hostnameHealthLabel;
  originLabel = hostnameOriginLabel;
  dnsSummary = hostnameDnsSummary;
  httpsSummary = hostnameHttpsSummary;
  dnsProviderShown = hostnameDnsProviderShown;
  dnsProviderOurs = hostnameDnsProviderOurs;
  dnsProviderBadgeClass = hostnameDnsProviderBadgeClass;
  repairRedirect = canRepairRedirect;

  actionStatement(hostname: HostnameStatus): string {
    return hostnameActionStatement(hostname, this.environmentSubdomainHint());
  }

  offerClearSiteUrl(hostname: HostnameStatus): boolean {
    return shouldOfferClearSiteUrl(hostname, this.environmentSubdomainHint());
  }

  useAsSiteUrl(hostname: HostnameStatus): boolean {
    return canUseAsSiteUrl(hostname, this.hostnameStatuses());
  }

  hasActions(hostname: HostnameStatus): boolean {
    return hostnameHasActions(
      hostname,
      this.hostnameStatuses(),
      this.environmentSubdomainHint(),
      this.canRemoveNgxSubdomain()
    );
  }

  onHostnameSortChange(sortState: SortableTableSortState): void {
    this.hostnameSortKey = sortState.key || "healthy";
    this.hostnameSortDirection = sortState.direction;
    this.updateQueryParams({
      [StoredValue.HOSTNAME_SORT]: this.hostnameSortKey,
      [StoredValue.HOSTNAME_SORT_ORDER]: this.hostnameSortDirection === DESCENDING ? SortDirection.DESC : SortDirection.ASC
    });
  }

  environmentSubdomainHint(): string {
    const fromHealth = this.hostnameStatuses().find(hostname => hostname.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN);
    if (fromHealth) {
      return fromHealth.hostname;
    } else if (this.environment) {
      return `${this.environment.name}.ngx-ramblers.org.uk`;
    } else {
      return "your-env.ngx-ramblers.org.uk";
    }
  }

  canRemoveNgxSubdomain(): boolean {
    return !!this.environment;
  }

  canRemoveEnvironmentSubdomainHost(hostname: HostnameStatus): boolean {
    return this.canRemoveNgxSubdomain() && isEnvironmentSubdomainHost(hostname, this.environmentSubdomainHint());
  }

  ngxSubdomainRemovalWarning(): string {
    const attachedCustom = this.customDomains().some(domain => domain.status === CustomDomainStatus.ATTACHED);
    if (attachedCustom) {
      return "This deletes its DNS records and Fly certificate. The app will only be reachable via its attached custom domains.";
    } else {
      const flyHost = this.environment?.appName
        ? `${this.environment.appName}.fly.dev`
        : "its Fly hostname";
      return `This deletes its DNS records and Fly certificate. Until you attach another hostname, the app is only reachable at ${flyHost}.`;
    }
  }

  async onCustomDomainsChanged(): Promise<void> {
    this.environmentChanged.emit();
    await this.refresh();
  }

  async repairApexRedirect(hostname: HostnameStatus): Promise<void> {
    if (this.customDomainsPanel && hostname.redirectRuleTarget) {
      await this.customDomainsPanel.setupApexRedirect(hostname.redirectRuleTarget);
    } else {
      this.notify.warning({
        title: "Cannot repair redirect",
        message: "No serving hostname was found for this redirect."
      });
    }
  }

  async removeApexRedirect(hostname: HostnameStatus): Promise<void> {
    if (this.customDomainsPanel) {
      await this.customDomainsPanel.removeApexRedirect(hostname);
    }
  }

  async clearSiteUrl(): Promise<void> {
    if (this.environment) {
      this.siteUrlBusy = true;
      try {
        const result = await this.environmentSetupService.updateSiteUrl(this.environment.name, null);
        if (result.success) {
          this.notify.success({title: "Site URL cleared", message: result.message});
          await this.refresh();
        } else {
          this.notify.error({title: "Could not clear Site URL", message: result.message});
        }
      } catch (error) {
        this.notify.error({title: "Could not clear Site URL", message: environmentOperationErrorDetail(error)});
      } finally {
        this.siteUrlBusy = false;
      }
    }
  }

  async setSiteUrlFromHostname(hostname: HostnameStatus): Promise<void> {
    if (this.environment) {
      this.siteUrlBusy = true;
      try {
        const result = await this.environmentSetupService.updateSiteUrl(this.environment.name, `https://${hostname.hostname}`);
        if (result.success) {
          this.notify.success({title: "Site URL updated", message: result.message});
          await this.refresh();
        } else {
          this.notify.error({title: "Could not set Site URL", message: result.message});
        }
      } catch (error) {
        this.notify.error({title: "Could not set Site URL", message: environmentOperationErrorDetail(error)});
      } finally {
        this.siteUrlBusy = false;
      }
    }
  }

  requestRemoveNgxSubdomain(): void {
    if (this.environment) {
      this.removeNgxSubdomainConfirming = true;
    }
  }

  cancelRemoveNgxSubdomain(): void {
    this.removeNgxSubdomainConfirming = false;
  }

  async confirmRemoveNgxSubdomain(): Promise<void> {
    if (this.environment) {
      this.removeNgxSubdomainConfirming = false;
      this.removingNgxSubdomain = true;
      try {
        const response = await this.environmentSetupService.removeSubdomain(this.environment.name);
        if (response.success) {
          this.notify.success({title: "NGX subdomain removed", message: response.message});
          this.environmentChanged.emit();
          await this.refresh();
        } else {
          this.notify.error({title: "Failed to remove NGX subdomain", message: response.message || "Failed to remove NGX subdomain"});
        }
      } catch (error) {
        this.notify.error({title: "Failed to remove NGX subdomain", message: environmentOperationErrorDetail(error)});
        this.logger.error("Remove NGX subdomain failed:", error);
      } finally {
        this.removingNgxSubdomain = false;
      }
    }
  }

  private async probeHostnameHealth(environmentName: string): Promise<void> {
    this.loadingHostnameHealth = true;
    this.hostnameHealthReport = null;
    this.hostnameHealthError = null;
    try {
      this.hostnameHealthReport = await this.environmentSetupService.hostnameHealth(environmentName);
    } catch (error) {
      this.hostnameHealthError = environmentOperationErrorDetail(error);
      this.logger.error("Failed to probe hostname health:", error);
    } finally {
      this.loadingHostnameHealth = false;
    }
  }

  private updateQueryParams(queryParams: Record<string, string | null>): void {
    this.router.navigate([], { queryParams, queryParamsHandling: "merge" });
  }
}
