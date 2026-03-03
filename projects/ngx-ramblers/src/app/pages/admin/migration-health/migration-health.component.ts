import { Component, inject, OnInit } from "@angular/core";
import {
  faCheckCircle,
  faChevronDown,
  faChevronUp,
  faExclamationTriangle,
  faExternalLinkAlt,
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
  HealthSortColumn
} from "../../../models/health.model";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { sortBy } from "../../../functions/arrays";
import { PageComponent } from "../../../page/page.component";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { NgClass, DatePipe } from "@angular/common";
import { DateUtilsService } from "../../../services/date-utils.service";
import { MigrationFileStatus } from "../../../models/mongo-migration-model";

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
          <button class="refresh-btn" [disabled]="loading" (click)="refresh()">
            <fa-icon [icon]="loading ? faSpinner : faRedo" [spin]="loading" class="me-1"/>
            {{ loading ? "Checking..." : "Refresh" }}
          </button>
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
                  <th class="sortable text-center" (click)="toggleSort(HealthSortColumn.APPLIED)">
                    Applied
                    @if (sortColumn === HealthSortColumn.APPLIED) {
                      <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable text-center" (click)="toggleSort(HealthSortColumn.PENDING)">
                    Pending
                    @if (sortColumn === HealthSortColumn.PENDING) {
                      <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable text-center" (click)="toggleSort(HealthSortColumn.FAILED)">
                    Failed
                    @if (sortColumn === HealthSortColumn.FAILED) {
                      <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="sortable text-center" (click)="toggleSort(HealthSortColumn.RESPONSE)">
                    Response
                    @if (sortColumn === HealthSortColumn.RESPONSE) {
                      <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                    }
                  </th>
                  <th class="text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                @for (env of sortedEnvironments(); track env.environment) {
                  <tr [ngClass]="rowClass(env)">
                    <td>
                      <span class="status-badge" [ngClass]="statusBadgeClass(env)">
                        <fa-icon [icon]="statusIcon(env)" class="me-1"/>
                        {{ statusLabel(env) }}
                      </span>
                    </td>
                    <td>
                      <div class="env-name">{{ env.environment }}</div>
                      <div class="env-app">{{ env.appName }}</div>
                    </td>
                    <td>
                      @if (env.healthResponse?.group?.shortName) {
                        {{ env.healthResponse.group.shortName }}
                      } @else {
                        <span class="placeholder-dash">—</span>
                      }
                    </td>
                    <td class="text-center">
                      @if (env.healthResponse?.migrations) {
                        <span class="metric-value">{{ env.healthResponse.migrations.applied }}</span>
                      } @else {
                        <span class="placeholder-dash">—</span>
                      }
                    </td>
                    <td class="text-center">
                      @if (env.healthResponse?.migrations) {
                        <span class="metric-value" [ngClass]="{'metric-warning': env.healthResponse.migrations.pending > 0}">
                          {{ env.healthResponse.migrations.pending }}
                        </span>
                      } @else {
                        <span class="placeholder-dash">—</span>
                      }
                    </td>
                    <td class="text-center">
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
                    <td class="text-center">
                      <span class="response-time">{{ formatResponseTime(env.responseTimeMs) }}</span>
                    </td>
                    <td class="text-center">
                      <a [href]="env.adminUrl" target="_blank" rel="noopener" class="admin-link">
                        <fa-icon [icon]="faExternalLinkAlt" class="me-1"/>Admin
                      </a>
                    </td>
                  </tr>
                  @if (isDegraded(env) && env.healthResponse?.migrations?.files?.length) {
                    <tr class="detail-row">
                      <td colspan="8">
                        <div class="detail-alert detail-alert-danger">
                          <strong>Failed migrations:</strong>
                          @for (file of failedFiles(env); track file.fileName) {
                            <div class="detail-file">
                              {{ file.fileName }}
                              @if (file.error) {
                                — <em>{{ file.error }}</em>
                              }
                            </div>
                          }
                        </div>
                      </td>
                    </tr>
                  }
                  @if (isUnreachable(env)) {
                    <tr class="detail-row">
                      <td colspan="8">
                        <div class="detail-alert detail-alert-warning">
                          <strong>Connection error:</strong> {{ env.error }}
                        </div>
                      </td>
                    </tr>
                  }
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

    .health-header
      display: flex
      justify-content: space-between
      align-items: flex-start
      margin-bottom: 24px

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
      background-color: rgba(220, 53, 69, 0.12)
      color: #dc3545

    .badge-pending
      background-color: rgba(255, 193, 7, 0.2)
      color: #856404

    .badge-unreachable
      background-color: rgba(108, 117, 125, 0.15)
      color: #495057

    .refresh-btn
      display: inline-flex
      align-items: center
      padding: 8px 20px
      border: none
      border-radius: 6px
      background: var(--ramblers-colour-mintcake, rgb(155, 200, 171))
      color: #fff
      font-weight: 600
      font-size: 0.875rem
      cursor: pointer
      transition: background-color 0.15s ease
      white-space: nowrap
      min-height: 40px

    .refresh-btn:hover:not(:disabled)
      background: var(--ramblers-colour-mintcake-hover-dark, rgb(99, 134, 110))

    .refresh-btn:disabled
      opacity: 0.7
      cursor: not-allowed

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
      overflow: hidden
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08)
      background: white

    .health-table
      width: 100%
      border-collapse: separate
      border-spacing: 0
      margin-bottom: 0

    .health-table th
      background: linear-gradient(to bottom, rgba(155, 200, 171, 0.3), rgba(155, 200, 171, 0.15))
      color: #495057
      font-weight: 600
      text-align: left
      padding: 12px 16px
      border-bottom: 2px solid rgba(155, 200, 171, 0.4)
      font-size: 0.85rem

    .health-table th.sortable
      cursor: pointer
      user-select: none

    .health-table th.sortable:hover
      background: rgba(155, 200, 171, 0.4)

    .health-table tbody tr td
      padding: 12px 16px
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
      border-left-color: #dc3545

    .row-pending td:first-child
      border-left-color: #ffc107

    .row-unreachable td:first-child
      border-left-color: #6c757d

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

    .admin-link
      display: inline-flex
      align-items: center
      padding: 6px 14px
      border: 1px solid rgba(155, 200, 171, 0.5)
      border-radius: 6px
      color: var(--ramblers-colour-mintcake-hover-dark, rgb(99, 134, 110))
      font-size: 0.8rem
      font-weight: 600
      text-decoration: none
      transition: all 0.15s ease
      white-space: nowrap

    .admin-link:hover
      background-color: rgba(155, 200, 171, 0.15)
      border-color: var(--ramblers-colour-mintcake, rgb(155, 200, 171))
      color: var(--ramblers-colour-mintcake-hover-dark, rgb(99, 134, 110))

    .detail-row td
      padding-top: 0 !important
      border-top: none !important

    .detail-alert
      padding: 10px 16px
      border-radius: 6px
      font-size: 0.85rem
      margin: 8px 8px 8px

    .detail-alert-danger
      background-color: rgba(220, 53, 69, 0.08)
      border: 1px solid rgba(220, 53, 69, 0.2)
      color: #842029

    .detail-alert-warning
      background-color: rgba(255, 193, 7, 0.1)
      border: 1px solid rgba(255, 193, 7, 0.3)
      color: #664d03

    .detail-file
      margin-left: 12px
      margin-top: 4px

    .last-checked
      margin-top: 16px
      font-size: 0.85rem
      color: #6c757d
  `],
  imports: [PageComponent, FontAwesomeModule, NgClass, DatePipe]
})
export class MigrationHealthComponent implements OnInit {
  private logger: Logger = inject(LoggerFactory).createLogger(MigrationHealthComponent, NgxLoggerLevel.ERROR);
  private crossEnvironmentHealthService = inject(CrossEnvironmentHealthService);
  protected dateUtils = inject(DateUtilsService);

  faCheckCircle = faCheckCircle;
  faChevronUp = faChevronUp;
  faChevronDown = faChevronDown;
  faExclamationTriangle = faExclamationTriangle;
  faTimesCircle = faTimesCircle;
  faQuestionCircle = faQuestionCircle;
  faSpinner = faSpinner;
  faRedo = faRedo;
  faExternalLinkAlt = faExternalLinkAlt;

  HealthSortColumn = HealthSortColumn;
  ASCENDING = ASCENDING;

  healthResponse: CrossEnvironmentHealthResponse | null = null;
  loading = false;
  error: string | null = null;
  sortColumn: HealthSortColumn = HealthSortColumn.ENVIRONMENT;
  sortDirection: string = ASCENDING;

  ngOnInit() {
    this.refresh();
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
      case EnvironmentHealthCheckStatus.DEGRADED: return "bg-danger";
      case EnvironmentHealthCheckStatus.UNREACHABLE: return "bg-dark";
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

  isDegraded(env: EnvironmentHealthCheck): boolean {
    return env.checkStatus === EnvironmentHealthCheckStatus.DEGRADED;
  }

  isUnreachable(env: EnvironmentHealthCheck): boolean {
    return env.checkStatus === EnvironmentHealthCheckStatus.UNREACHABLE;
  }

  failedFiles(env: EnvironmentHealthCheck) {
    return (env.healthResponse?.migrations?.files || []).filter(f => f.status === MigrationFileStatus.FAILED);
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
    const environments = this.healthResponse?.environments || [];
    const prefix = this.sortDirection === DESCENDING ? "-" : "";
    return [...environments].sort(sortBy(`${prefix}${this.sortColumn}`));
  }

  formatResponseTime(ms: number): string {
    if (ms >= 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${ms}ms`;
  }
}
