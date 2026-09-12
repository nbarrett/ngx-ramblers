import { Component, inject, OnInit } from "@angular/core";
import {
  faCheckCircle,
  faChevronDown,
  faChevronUp,
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
  EnvironmentHealthCheckStatus,
  EnvironmentHealthFinding,
  EnvironmentHealthFindingSeverity,
  HealthSortColumn
} from "../../../models/health.model";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { sortBy } from "../../../functions/arrays";
import { hostFromUrl } from "../../../functions/hosts";
import { kebabCase } from "es-toolkit/compat";
import { AdminPlatformPath } from "../../../models/admin-route-paths.model";
import {
  CrossEnvironmentHostnameHealth,
  EnvironmentSetupTab,
  HostnameHealthReport,
  HostnameOrigin,
  ManageAction,
  SetupMode
} from "../../../models/environment-setup.model";
import { StoredValue } from "../../../models/ui-actions";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgClass, DatePipe } from "@angular/common";
import { DateUtilsService } from "../../../services/date-utils.service";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { BsDropdownDirective, BsDropdownMenuDirective, BsDropdownToggleDirective } from "ngx-bootstrap/dropdown";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";

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
                <span class="text-muted text-nowrap">{{ sortedEnvironments().length }} of {{ healthResponse.summary.total }}</span>
              </div>
            }
            <button class="btn btn-primary" [disabled]="loading" (click)="refresh()">
              <fa-icon [icon]="loading ? faSpinner : faRedo" [animation]="loading ? 'spin' : undefined" class="me-1"/>
              {{ loading ? "Checking..." : "Refresh" }}
            </button>
          </div>
        </div>

        @if (error) {
          <div class="alert alert-danger" role="alert">
            <fa-icon [icon]="faTimesCircle" class="me-2"/>
            {{ error }}
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

        @if (healthResponse) {
          <div class="health-table-card">
            <table class="health-table">
              <thead>
                <tr>
                  <th class="sortable" (click)="toggleSort(HealthSortColumn.STATUS)">
                    Status
                    @if (sortColumn === HealthSortColumn.STATUS) {
                      <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable" (click)="toggleSort(HealthSortColumn.ENVIRONMENT)">
                    Environment
                    @if (sortColumn === HealthSortColumn.ENVIRONMENT) {
                      <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable" (click)="toggleSort(HealthSortColumn.GROUP)">
                    Group
                    @if (sortColumn === HealthSortColumn.GROUP) {
                      <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable text-center col-metric" (click)="toggleSort(HealthSortColumn.APPLIED)">
                    Applied
                    @if (sortColumn === HealthSortColumn.APPLIED) {
                      <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable text-center col-metric" (click)="toggleSort(HealthSortColumn.PENDING)">
                    Pending
                    @if (sortColumn === HealthSortColumn.PENDING) {
                      <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable text-center col-metric" (click)="toggleSort(HealthSortColumn.FAILED)">
                    Failed
                    @if (sortColumn === HealthSortColumn.FAILED) {
                      <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable text-center col-metric" (click)="toggleSort(HealthSortColumn.RESPONSE)">
                    Response
                    @if (sortColumn === HealthSortColumn.RESPONSE) {
                      <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="col-admin"></th>
                </tr>
              </thead>
              <tbody>
                @for (env of sortedEnvironments(); track env.environment; let last = $last) {
                  <tr [ngClass]="rowClass(env)">
                    <td>
                      <span class="status-badge" [ngClass]="statusBadgeClass(env)"
                            [tooltip]="findingsTooltip(env)" [isDisabled]="!visibleFindings(env).length" container="body">
                        <fa-icon [icon]="statusIcon(env)" class="me-1"/>
                        {{ statusLabel(env) }}
                      </span>
                    </td>
                    <td class="col-environment">
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
                    </td>
                    <td>
                      @if (env.healthResponse?.group?.shortName) {
                        {{ env.healthResponse.group.shortName }}
                      } @else {
                        <span class="placeholder-dash">—</span>
                      }
                    </td>
                    <td class="text-center col-metric">
                      @if (env.healthResponse?.migrations) {
                        <span class="metric-value">{{ env.healthResponse.migrations.applied }}</span>
                      } @else {
                        <span class="placeholder-dash">—</span>
                      }
                    </td>
                    <td class="text-center col-metric">
                      @if (env.healthResponse?.migrations) {
                        <span class="metric-value" [ngClass]="{'metric-warning': env.healthResponse.migrations.pending > 0}">
                          {{ env.healthResponse.migrations.pending }}
                        </span>
                      } @else {
                        <span class="placeholder-dash">—</span>
                      }
                    </td>
                    <td class="text-center col-metric">
                      @if (env.healthResponse?.migrations) {
                        @if (env.healthResponse.migrations.failed) {
                          <span class="metric-value metric-danger">Yes</span>
                        } @else {
                          <span class="metric-value metric-ok">No</span>
                        }
                      } @else {
                        <span class="placeholder-dash">—</span>
                      }
                    </td>
                    <td class="text-center col-metric">
                      <span class="response-time">{{ formatResponseTime(env.responseTimeMs) }}</span>
                    </td>
                    <td class="col-admin">
                      <div class="btn-group" dropdown [dropup]="last">
                        <button type="button" class="admin-link dropdown-toggle" dropdownToggle>
                          Admin
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
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="8" class="text-center text-muted py-4">No environments match that search.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <div class="last-checked">
            Last checked: {{ healthResponse.timestamp | date:"medium" }}
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

    .health-table-card
      border: 1px solid rgba(155, 200, 171, 0.4)
      border-radius: 8px
      overflow: visible
      max-width: 100%
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08)
      background: white

    .health-table
      width: 100%
      table-layout: fixed
      border-collapse: separate
      border-spacing: 0
      margin-bottom: 0

    .health-table th,
    .health-table td
      overflow: hidden

    .health-table th
      background: var(--rsm-table-header-bg)
      color: #495057
      font-weight: 600
      text-align: left
      padding: 12px 10px
      border-bottom: 2px solid rgba(155, 200, 171, 0.4)
      font-size: 0.85rem
      white-space: nowrap

    .health-table th.col-metric,
    .health-table td.col-metric
      width: 4.75rem
      padding-left: 6px
      padding-right: 6px

    .health-table th:first-child,
    .health-table td:first-child
      width: 8.25rem

    .health-table td.col-environment
      width: auto

    .health-table th:nth-child(3),
    .health-table td:nth-child(3)
      width: 6.5rem

    .health-table th.col-admin,
    .health-table td.col-admin
      width: 8.5rem
      padding-left: 8px
      padding-right: 24px
      text-align: right
      overflow: visible

    .health-table tbody tr td.col-admin
      padding-right: 24px

    .health-table th.sortable
      cursor: pointer
      user-select: none

    .health-table th.sortable:hover
      background: rgba(155, 200, 171, 0.4)

    .health-table tbody tr td
      padding: 12px
      vertical-align: middle
      border-bottom: 1px solid #e9ecef
      font-size: 0.9rem
      transition: background-color 0.15s ease

    .health-table tbody tr:last-child td
      border-bottom: none

    .health-table tbody tr:nth-child(odd)
      background-color: #ffffff

    .health-table tbody tr:nth-child(even)
      background-color: #f8f9fa

    .health-table tbody tr:hover
      background-color: rgba(155, 200, 171, 0.1)

    .health-table tbody tr td:first-child
      border-left: 4px solid transparent

    .row-healthy td:first-child
      border-left-color: var(--ramblers-colour-mintcake, rgb(155, 200, 171))

    .row-degraded td:first-child
      border-left-color: #ffc107

    .row-pending td:first-child
      border-left-color: #ffc107

    .row-unreachable td:first-child
      border-left-color: #dc3545

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

    .admin-link
      display: inline-flex
      align-items: center
      gap: 6px
      padding: 6px 12px
      border: 1px solid rgba(155, 200, 171, 0.5)
      border-radius: 6px
      background: white
      color: var(--ramblers-colour-mintcake-hover-dark, rgb(99, 134, 110))
      font-size: 0.8rem
      font-weight: 600
      text-decoration: none
      white-space: nowrap
      min-height: 32px

    .admin-link:hover
      background-color: rgba(155, 200, 171, 0.15)
      border-color: var(--ramblers-colour-mintcake, rgb(155, 200, 171))
      color: var(--ramblers-colour-mintcake-hover-dark, rgb(99, 134, 110))

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
  imports: [PageComponent, FontAwesomeModule, NgClass, DatePipe, TooltipDirective, BsDropdownDirective, BsDropdownToggleDirective, BsDropdownMenuDirective, RouterLink, FormsModule]
})
export class MigrationHealthComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger(MigrationHealthComponent, NgxLoggerLevel.ERROR);
  private crossEnvironmentHealthService = inject(CrossEnvironmentHealthService);
  private router = inject(Router);
  private activatedRoute = inject(ActivatedRoute);
  protected dateUtils = inject(DateUtilsService);

  faCheckCircle = faCheckCircle;
  faChevronUp = faChevronUp;
  faChevronDown = faChevronDown;
  faExclamationTriangle = faExclamationTriangle;
  faTimesCircle = faTimesCircle;
  faQuestionCircle = faQuestionCircle;
  faSpinner = faSpinner;
  faRedo = faRedo;

  HealthSortColumn = HealthSortColumn;
  ASCENDING = ASCENDING;
  AdminPlatformPath = AdminPlatformPath;

  healthResponse: CrossEnvironmentHealthResponse | null = null;
  loading = false;
  error: string | null = null;
  sortColumn: HealthSortColumn = HealthSortColumn.STATUS;
  sortDirection: string = ASCENDING;
  hostnameHealth: CrossEnvironmentHostnameHealth | null = null;
  loadingHostnameHealth = false;
  search = "";

  ngOnInit() {
    this.search = this.activatedRoute.snapshot.queryParams[StoredValue.SEARCH] || "";
    this.refresh();
  }

  onSearchChange(value: string): void {
    this.search = value;
    this.router.navigate([], {
      queryParams: { [StoredValue.SEARCH]: value.trim() || null },
      queryParamsHandling: "merge"
    });
  }

  async refresh() {
    this.loading = true;
    this.error = null;
    try {
      this.healthResponse = await this.crossEnvironmentHealthService.healthCheck();
      this.logger.debug("Health response:", this.healthResponse);
    } catch (error: any) {
      this.error = error?.error?.error || error?.message || "Failed to fetch environment health";
      this.logger.error("Health check failed:", error);
    } finally {
      this.loading = false;
    }
    this.refreshHostnameHealth();
  }

  private async refreshHostnameHealth(forceRefresh?: boolean): Promise<void> {
    this.loadingHostnameHealth = true;
    try {
      this.hostnameHealth = await this.crossEnvironmentHealthService.hostnameHealth(forceRefresh);
      this.logger.debug("Hostname health:", this.hostnameHealth);
    } catch (error: any) {
      this.logger.error("Hostname health check failed:", error);
    } finally {
      this.loadingHostnameHealth = false;
    }
  }

  hostnameReportFor(environmentName: string): HostnameHealthReport | null {
    return this.hostnameHealth?.environments?.find(report => report.environmentName === environmentName) || null;
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
    const report = this.hostnameReportFor(env.environment);
    const mapped = (report?.hostnames || []).filter(item =>
      item.origin === HostnameOrigin.SITE_URL
      || item.origin === HostnameOrigin.CUSTOM_DOMAIN
      || item.origin === HostnameOrigin.ENVIRONMENT_SUBDOMAIN);
    if (mapped.length) {
      return mapped.map(item => item.hostname);
    } else {
      const site = this.siteHostname(env);
      return site ? [site] : [];
    }
  }

  hostnameTooltipFor(env: EnvironmentHealthCheck, host: string): string {
    const report = this.hostnameReportFor(env.environment);
    const match = report?.hostnames?.find(item => item.hostname === host);
    return match?.message || "Open site";
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

  rowClass(env: EnvironmentHealthCheck): string {
    switch (env.checkStatus) {
      case EnvironmentHealthCheckStatus.HEALTHY: return "row-healthy";
      case EnvironmentHealthCheckStatus.DEGRADED: return "row-degraded";
      case EnvironmentHealthCheckStatus.UNREACHABLE: return "row-unreachable";
      case EnvironmentHealthCheckStatus.PENDING: return "row-pending";
      default: return "";
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

  toggleSort(column: HealthSortColumn) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === ASCENDING ? DESCENDING : ASCENDING;
    } else {
      this.sortColumn = column;
      this.sortDirection = ASCENDING;
    }
  }

  sortedEnvironments(): EnvironmentHealthCheck[] {
    const environments = (this.healthResponse?.environments || []).filter(env => this.matchesSearch(env));
    if (this.sortColumn === HealthSortColumn.STATUS) {
      const ranked = [...environments].sort((left, right) => {
        const rankDiff = this.statusRank(left.checkStatus) - this.statusRank(right.checkStatus);
        if (rankDiff !== 0) {
          return this.sortDirection === DESCENDING ? -rankDiff : rankDiff;
        } else {
          return left.environment.localeCompare(right.environment);
        }
      });
      return ranked;
    } else {
      const prefix = this.sortDirection === DESCENDING ? "-" : "";
      return [...environments].sort(sortBy(`${prefix}${this.sortColumn}`));
    }
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
    }
    return `${ms}ms`;
  }
}
