import { ChangeDetectorRef, Component, inject, OnInit, OnDestroy } from "@angular/core";
import {
  faCheckCircle,
  faEllipsisVertical,
  faStop,
  faExclamationTriangle,
  faQuestionCircle,
  faRedo,
  faSpinner,
  faTimesCircle
} from "@fortawesome/free-solid-svg-icons";
import { NgxLoggerLevel } from "ngx-logger";
import { Logger, LoggerFactory } from "../../../services/logger-factory.service";
import { CrossEnvironmentHealthService } from "../../../services/cross-environment-health.service";
import {
  CrossEnvironmentHealthResponse,
  EnvironmentHealthCheck,
  EnvironmentHealthRow,
  EnvironmentHealthCheckStatus,
  EnvironmentHealthFinding,
  EnvironmentHealthFindingSeverity,
  HealthSortColumn
} from "../../../models/health.model";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { hostFromUrl } from "../../../functions/hosts";
import { kebabCase, values } from "es-toolkit/compat";
import { AdminPlatformPath } from "../../../models/admin-route-paths.model";
import {
  EnvironmentSetupTab,
  ManageAction,
  SetupMode
} from "../../../models/environment-setup.model";
import { StoredValue } from "../../../models/ui-actions";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgClass } from "@angular/common";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import {Subscription} from "rxjs";
import {SortableTableComponent} from "../../../modules/common/sortable-table/sortable-table.component";
import {SortableTableCellDirective} from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import {SortableTableAlignment, SortableTableColumn, SortableTableSortState} from "../../../modules/common/sortable-table/sortable-table.model";
import {DisplayDateAndTimePipe} from "../../../pipes/display-date-and-time.pipe";

@Component({
  selector: "app-migration-health",
  template: `
    <app-page>
      <div class="health-container">
        <div class="health-header">
          <div class="health-title-group">
            <h2 class="health-title">Environments Monitoring</h2>
            @if (healthResponse) {
              <div class="summary-badges">
                <span class="summary-badge badge-total">{{ healthResponse.summary.total }} environments</span>
                <span class="summary-badge badge-healthy">
                  <fa-icon [icon]="faCheckCircle" class="me-1"/>{{ healthResponse.summary.healthy }} healthy
                </span>
                @if (healthResponse.summary.degraded > 0) {
                  <span class="summary-badge badge-degraded">
                    <fa-icon [icon]="faExclamationTriangle" class="me-1"/>{{ healthResponse.summary.degraded }} degraded
                  </span>
                }
                @if (healthResponse.summary.pending > 0) {
                  <span class="summary-badge badge-pending">
                    <fa-icon [icon]="faSpinner" class="me-1"/>{{ healthResponse.summary.pending }} pending
                  </span>
                }
                @if (healthResponse.summary.unreachable > 0) {
                  <span class="summary-badge badge-unreachable">
                    <fa-icon [icon]="faTimesCircle" class="me-1"/>{{ healthResponse.summary.unreachable }} unreachable
                  </span>
                }
              </div>
            }
          </div>
          <div class="health-header-actions">
            @if (healthResponse) {
              <div class="health-search">
                <label class="visually-hidden" for="environment-search">Search environments</label>
                <input id="environment-search" class="form-control" type="search"
                       [ngModel]="search"
                       (ngModelChange)="onSearchChange($event)"
                       placeholder="Search environments">
                <span class="text-muted text-nowrap">{{ filteredEnvironments().length }} of {{ healthResponse.summary.total }}</span>
              </div>
            }
            @if (loading) {
              <button class="btn btn-quiet" (click)="stop()">
                <fa-icon [icon]="faStop" class="me-1"/>Stop
              </button>
            }
            <button class="btn btn-primary" [disabled]="loading" (click)="refresh()">
              <fa-icon [icon]="loading ? faSpinner : faRedo" [animation]="loading ? 'spin' : null" class="me-1"/>
              {{ loading ? "Checking..." : "Refresh" }}
            </button>
          </div>
        </div>

        @if (error) {
          <div class="alert alert-danger d-flex align-items-start" role="alert">
            <fa-icon [icon]="faTimesCircle" class="me-2"/>
            <div><strong class="d-block">Health checks could not finish</strong>{{ error }}</div>
          </div>
        }

        @if (loading && !healthResponse) {
          <div class="loading-state">
            <div class="spinner-border" role="status">
              <span class="visually-hidden">Loading...</span>
            </div>
            <p>Checking all environments...</p>
          </div>
        }

        @if (stopped && !healthResponse) {
          <p class="text-muted" role="status">Checks stopped before any environments responded.</p>
        }

        @if (healthResponse) {
          <p class="text-muted" role="status" aria-live="polite">
            {{ loading ? "Checking" : (stopped ? "Stopped after" : "Checked") }}
            {{ healthResponse.environments.length }} of {{ healthResponse.summary.total }} environments.
            @if (stopped) { Results received so far are retained. }
          </p>
          <app-sortable-table [rows]="filteredEnvironments()" [columns]="columns"
                              [defaultSortKey]="sortColumn" [defaultSortDirection]="sortDirection"
                              [trackBy]="trackEnvironment" (sortChange)="sortChanged($event)"
                              [emptyMessage]="loading ? 'Waiting for matching environments to respond…' : 'No environments match that search.'">
            <ng-template appSortableTableCell="status" let-env>
              <span class="status-badge" [ngClass]="statusBadgeClass(env)"
                    [tooltip]="findingsTooltip(env)" [isDisabled]="!visibleFindings(env).length" container="body">
                <fa-icon [icon]="statusIcon(env)" class="me-1"/>
                {{ statusLabel(env) }}
              </span>
            </ng-template>
            <ng-template appSortableTableCell="environment" let-env>
              <div class="env-name">{{ env.environment }}</div>
              <div class="env-app">{{ env.appName }}</div>
              @let hosts = displayedHostnames(env);
              <div class="hostname-list">
                @for (host of hosts; track host) {
                  <a class="hostname-link" [href]="'https://' + host" target="_blank" rel="noopener"
                     [tooltip]="hostnameTooltipFor(env, host)" container="body">{{ host }}</a>
                }
              </div>
              @if (primaryFinding(env); as finding) {
                <div class="env-finding" [ngClass]="findingTextClass(env)">{{ finding.message }}</div>
              }
            </ng-template>
            <ng-template appSortableTableCell="group" let-env>
              @if (env.healthResponse?.group?.shortName) {
                {{ env.healthResponse.group.shortName }}
              } @else {
                <span class="placeholder-dash">—</span>
              }
            </ng-template>
            <ng-template appSortableTableCell="applied" let-env>
              @if (env.healthResponse?.migrations) {
                <span class="metric-value">{{ env.healthResponse.migrations.applied }}</span>
              } @else {
                <span class="placeholder-dash">—</span>
              }
            </ng-template>
            <ng-template appSortableTableCell="pending" let-env>
              @if (env.healthResponse?.migrations) {
                <span class="metric-value" [ngClass]="{'metric-warning': env.healthResponse.migrations.pending > 0}">
                  {{ env.healthResponse.migrations.pending }}
                </span>
              } @else {
                <span class="placeholder-dash">—</span>
              }
            </ng-template>
            <ng-template appSortableTableCell="failed" let-env>
              @if (env.healthResponse?.migrations) {
                @if (env.healthResponse.migrations.failed) {
                  <span class="metric-value metric-danger">Yes</span>
                } @else {
                  <span class="metric-value metric-ok">No</span>
                }
              } @else {
                <span class="placeholder-dash">—</span>
              }
            </ng-template>
            <ng-template appSortableTableCell="response" let-env>
              <span class="response-time">{{ formatResponseTime(env.responseTimeMs) }}</span>
            </ng-template>
            <ng-template appSortableTableCell="actions" let-env>
              <div class="btn-group" dropdown container="body" placement="bottom right">
                <button type="button" class="btn btn-primary btn-icon" dropdownToggle
                        [attr.aria-label]="'Admin actions for ' + env.environment" tooltip="Admin actions" container="body">
                  <fa-icon [icon]="faEllipsisVertical"/>
                </button>
                <ul *dropdownMenu class="dropdown-menu dropdown-menu-end" role="menu">
                  <li role="menuitem">
                    <a class="dropdown-item" [href]="env.adminUrl" target="_blank" rel="noopener">
                      Open {{ env.environment }}
                    </a>
                  </li>
                  <li role="menuitem">
                    <a class="dropdown-item" [routerLink]="'/' + AdminPlatformPath.ENVIRONMENT_MANAGEMENT_SETUP"
                       [queryParams]="setupQueryParams(env)">
                      Environment setup
                    </a>
                  </li>
                </ul>
              </div>
            </ng-template>
          </app-sortable-table>

          <div class="last-checked">
            Latest result: {{ healthResponse.timestamp | displayDateAndTime }}
          </div>
        }
      </div>
    </app-page>
  `,
  styles: [`
    .health-container
      padding-top: 16px
      max-width: 100%

    .health-header
      display: flex
      justify-content: space-between
      align-items: flex-start
      gap: 16px
      margin-bottom: 24px
      flex-wrap: wrap

    .health-header-actions
      display: flex
      align-items: center
      gap: 12px
      flex: 1 1 auto
      justify-content: flex-end
      flex-wrap: wrap

    .health-search
      display: flex
      align-items: center
      gap: 12px
      flex: 1 1 22rem
      max-width: 44rem

    .health-search .form-control
      min-height: 40px
      flex: 1 1 auto
      min-width: 0

    .health-search .form-control[type=search]
      padding-left: 2.25rem
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' fill='%236c757d'%3E%3Cpath d='M416 208c0 45.9-14.9 88.3-40 122.7L502.6 457.4c12.5 12.5 12.5 32.8 0 45.3s-32.8 12.5-45.3 0L330.7 376c-34.4 25.2-76.8 40-122.7 40C93.1 416 0 322.9 0 208S93.1 0 208 0S416 93.1 416 208zM208 352a144 144 0 1 0 0-288 144 144 0 1 0 0 288z'/%3E%3C/svg%3E")
      background-repeat: no-repeat
      background-position: 0.75rem center
      background-size: 0.9rem 0.9rem

    .health-title-group
      display: flex
      flex-direction: column
      gap: 12px

    .health-title
      margin: 0
      font-size: 1.5rem
      font-weight: 600
      color: #212529

    .summary-badges
      display: flex
      flex-wrap: wrap
      gap: 8px

    .summary-badge
      display: inline-flex
      align-items: center
      padding: 4px 12px
      border-radius: 999px
      font-size: 0.8rem
      font-weight: 600

    .badge-total
      background-color: #f0f0f0
      color: #495057

    .badge-healthy
      background-color: rgba(155, 200, 171, 0.25)
      color: var(--ramblers-colour-mintcake-hover-dark, rgb(99, 134, 110))

    .badge-degraded
      background-color: rgba(255, 193, 7, 0.2)
      color: #856404

    .badge-pending
      background-color: rgba(255, 193, 7, 0.2)
      color: #856404

    .badge-unreachable
      background-color: rgba(220, 53, 69, 0.12)
      color: #dc3545

    .loading-state
      text-align: center
      padding: 48px 0

    .loading-state .spinner-border
      color: var(--ramblers-colour-mintcake, rgb(155, 200, 171))

    .loading-state p
      margin-top: 16px
      color: #6c757d

    .status-badge
      display: inline-flex
      align-items: center
      padding: 4px 10px
      border-radius: 999px
      font-size: 0.78rem
      font-weight: 600
      white-space: nowrap

    .bg-success
      background-color: rgba(155, 200, 171, 0.25) !important
      color: var(--ramblers-colour-mintcake-hover-dark, rgb(99, 134, 110)) !important

    .bg-danger
      background-color: rgba(220, 53, 69, 0.12) !important
      color: #dc3545 !important

    .bg-warning
      background-color: rgba(255, 193, 7, 0.2) !important
      color: #856404 !important

    .bg-dark
      background-color: rgba(108, 117, 125, 0.15) !important
      color: #495057 !important

    .env-name
      font-weight: 600
      color: #212529

    .env-app
      font-size: 0.8rem
      color: #6c757d
      margin-top: 2px

    .env-finding
      margin-top: 4px
      font-size: 0.8rem
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap

    .env-finding-warning
      color: #856404

    .env-finding-error
      color: #dc3545

    .hostname-list
      display: flex
      flex-direction: column
      gap: 2px
      min-width: 0

    .hostname-link
      font-size: 0.8rem
      font-weight: 600
      color: var(--ramblers-colour-mintcake-hover-dark, rgb(99, 134, 110))
      text-decoration: none
      overflow: hidden
      text-overflow: ellipsis
      white-space: nowrap

    .hostname-link:hover
      text-decoration: underline

    .placeholder-dash
      color: #adb5bd

    .metric-value
      font-weight: 600
      font-size: 0.95rem

    .metric-warning
      color: #e67e00
      background: rgba(255, 193, 7, 0.15)
      padding: 2px 8px
      border-radius: 4px

    .metric-danger
      color: #dc3545

    .metric-ok
      color: var(--ramblers-colour-mintcake-hover-dark, rgb(99, 134, 110))

    .response-time
      color: #6c757d
      font-size: 0.85rem
      font-variant-numeric: tabular-nums

    .last-checked
      margin-top: 16px
      font-size: 0.85rem
      color: #6c757d
  `],
  imports: [PageComponent, FontAwesomeModule, NgClass, DisplayDateAndTimePipe, SortableTableComponent, SortableTableCellDirective, TooltipDirective, BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, RouterLink, FormsModule]
})
export class MigrationHealthComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger(MigrationHealthComponent, NgxLoggerLevel.ERROR);
  private changeDetector = inject(ChangeDetectorRef);
  private crossEnvironmentHealthService = inject(CrossEnvironmentHealthService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);

  faCheckCircle = faCheckCircle;
  faEllipsisVertical = faEllipsisVertical;
  faStop = faStop;
  faExclamationTriangle = faExclamationTriangle;
  faTimesCircle = faTimesCircle;
  faQuestionCircle = faQuestionCircle;
  faSpinner = faSpinner;
  faRedo = faRedo;

  AdminPlatformPath = AdminPlatformPath;

  healthResponse: CrossEnvironmentHealthResponse | null = null;
  loading = false;
  error: string | null = null;
  stopped = false;
  private healthSubscription: Subscription | null = null;
  private subscriptions: Subscription[] = [];
  columns: SortableTableColumn<EnvironmentHealthRow>[] = [
    {key: "status", label: "Status", sortKey: HealthSortColumn.STATUS, width: "8rem"},
    {key: "environment", label: "Environment", sortKey: HealthSortColumn.ENVIRONMENT},
    {key: "group", label: "Group", sortKey: HealthSortColumn.GROUP},
    {key: "applied", label: "Applied", sortKey: HealthSortColumn.APPLIED, align: SortableTableAlignment.CENTER, width: "5rem"},
    {key: "pending", label: "Pending", sortKey: HealthSortColumn.PENDING, align: SortableTableAlignment.CENTER, width: "5rem"},
    {key: "failed", label: "Failed", sortKey: HealthSortColumn.FAILED, align: SortableTableAlignment.CENTER, width: "5rem"},
    {key: "response", label: "Response", sortKey: HealthSortColumn.RESPONSE, align: SortableTableAlignment.CENTER, width: "6rem"},
    {key: "actions", label: "", align: SortableTableAlignment.RIGHT, width: "4rem"}
  ];
  trackEnvironment = (_index: number, environment: EnvironmentHealthRow): string => environment.environment;
  sortColumn: HealthSortColumn = HealthSortColumn.STATUS;
  sortDirection: string = ASCENDING;
  search = "";

  ngOnInit() {
    this.search = this.activatedRoute.snapshot.queryParams[StoredValue.SEARCH] || "";
    const sort = this.activatedRoute.snapshot.queryParams[StoredValue.SORT];
    this.sortColumn = values(HealthSortColumn).includes(sort) ? sort : HealthSortColumn.STATUS;
    this.sortDirection = this.activatedRoute.snapshot.queryParams[StoredValue.SORT_ORDER] === DESCENDING ? DESCENDING : ASCENDING;
    this.refresh();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.router.navigate([], {
      queryParams: { [StoredValue.SEARCH]: value.trim() || null },
      queryParamsHandling: "merge"
    });
  }

  refresh(): void {
    this.healthSubscription?.unsubscribe();
    this.loading = true;
    this.stopped = false;
    this.error = null;
    this.healthResponse = null;
    this.healthSubscription = this.crossEnvironmentHealthService.progressiveHealthCheck().subscribe({
      next: progress => {
        this.healthResponse = progress.response;
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.error = error?.error?.error || error?.message || "Failed to fetch environment health";
        this.logger.error("Health check failed:", error);
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      complete: () => {
        this.loading = false;
        this.changeDetector.markForCheck();
      }
    });
    this.subscriptions.push(this.healthSubscription);
  }

  stop(): void {
    this.healthSubscription?.unsubscribe();
    this.loading = false;
    this.stopped = true;
  }

  setupQueryParams(env: EnvironmentHealthCheck): Record<string, string> {
    return {
      [StoredValue.TAB]: kebabCase(EnvironmentSetupTab.CREATE),
      [StoredValue.SETUP_MODE]: SetupMode.MANAGE,
      [StoredValue.MANAGE_ACTION]: ManageAction.MODIFY,
      [StoredValue.ENVIRONMENT]: env.environment
    };
  }

  siteHostname(env: EnvironmentHealthCheck): string {
    return hostFromUrl(env.adminUrl);
  }

  displayedHostnames(env: EnvironmentHealthCheck): string[] {
    const mapped = env.hostnames || [];
    if (mapped.length) {
      return mapped.map(item => item.hostname);
    } else {
      const site = this.siteHostname(env);
      return site ? [site] : [];
    }
  }

  hostnameTooltipFor(env: EnvironmentHealthCheck, host: string): string {
    return env.findings?.find(finding => finding.message.includes(host))?.message || "Open site";
  }

  statusIcon(env: EnvironmentHealthCheck) {
    switch (env.checkStatus) {
      case EnvironmentHealthCheckStatus.HEALTHY: return this.faCheckCircle;
      case EnvironmentHealthCheckStatus.DEGRADED: return this.faExclamationTriangle;
      case EnvironmentHealthCheckStatus.UNREACHABLE: return this.faTimesCircle;
      case EnvironmentHealthCheckStatus.PENDING: return this.faSpinner;
      default: return this.faQuestionCircle;
    }
  }

  statusLabel(env: EnvironmentHealthCheck): string {
    switch (env.checkStatus) {
      case EnvironmentHealthCheckStatus.HEALTHY: return "Healthy";
      case EnvironmentHealthCheckStatus.DEGRADED: return "Degraded";
      case EnvironmentHealthCheckStatus.UNREACHABLE: return "Unreachable";
      case EnvironmentHealthCheckStatus.PENDING: return "Pending";
      default: return "Unknown";
    }
  }

  statusBadgeClass(env: EnvironmentHealthCheck): string {
    switch (env.checkStatus) {
      case EnvironmentHealthCheckStatus.HEALTHY: return "bg-success";
      case EnvironmentHealthCheckStatus.DEGRADED: return "bg-warning text-dark";
      case EnvironmentHealthCheckStatus.UNREACHABLE: return "bg-danger";
      case EnvironmentHealthCheckStatus.PENDING: return "bg-warning text-dark";
      default: return "bg-secondary";
    }
  }

  visibleFindings(env: EnvironmentHealthCheck): EnvironmentHealthFinding[] {
    return (env.findings || []).filter(finding => finding.severity !== EnvironmentHealthFindingSeverity.OK);
  }

  primaryFinding(env: EnvironmentHealthCheck): EnvironmentHealthFinding | null {
    return this.visibleFindings(env)[0] || null;
  }

  findingsTooltip(env: EnvironmentHealthCheck): string {
    return this.visibleFindings(env).map(finding => finding.message).join("\n");
  }

  findingTextClass(env: EnvironmentHealthCheck): string {
    if (env.checkStatus === EnvironmentHealthCheckStatus.UNREACHABLE) {
      return "env-finding-error";
    } else {
      return "env-finding-warning";
    }
  }

  sortChanged(sort: SortableTableSortState): void {
    this.sortColumn = sort.key as HealthSortColumn;
    this.sortDirection = sort.direction;
    this.router.navigate([], {
      queryParams: {[StoredValue.SORT]: sort.key, [StoredValue.SORT_ORDER]: sort.direction},
      queryParamsHandling: "merge"
    });
  }

  filteredEnvironments(): EnvironmentHealthRow[] {
    return (this.healthResponse?.environments || [])
      .filter(env => this.matchesSearch(env))
      .sort((left, right) => left.environment.localeCompare(right.environment))
      .map(env => ({...env, statusRank: this.statusRank(env.checkStatus)}));
  }

  matchesSearch(env: EnvironmentHealthCheck): boolean {
    const needle = this.search.trim().toLowerCase();
    if (!needle) {
      return true;
    } else {
      const haystack = [
        env.environment,
        env.appName,
        env.adminUrl,
        this.statusLabel(env),
        env.healthResponse?.group?.shortName || "",
        ...this.displayedHostnames(env)
      ].join(" ").toLowerCase();
      return haystack.includes(needle);
    }
  }

  private statusRank(status: EnvironmentHealthCheckStatus): number {
    if (status === EnvironmentHealthCheckStatus.UNREACHABLE) {
      return 0;
    } else if (status === EnvironmentHealthCheckStatus.DEGRADED) {
      return 1;
    } else if (status === EnvironmentHealthCheckStatus.PENDING) {
      return 2;
    } else {
      return 3;
    }
  }

  formatResponseTime(ms: number): string {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    } else {
      return `${ms}ms`;
    }
  }
}
