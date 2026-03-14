import { Component, inject, Input, OnInit } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { DateTime } from "luxon";
import { sortBy } from "es-toolkit/compat";
import { ASCENDING, DESCENDING } from "../../../../models/table-filtering.model";
import {
  EmailAuthResult,
  EmailRoutingLogEntry,
  EmailRoutingLogStatus,
  WorkerInvocationSummary
} from "../../../../models/cloudflare-email-routing.model";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { ALERT_ERROR } from "../../../../models/alert-target.model";
import { AlertComponent } from "ngx-bootstrap/alert";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { CloudflareButton } from "../../../../modules/common/third-parties/cloudflare-button";
import { DateRange, DateRangeSlider } from "../../../../components/date-range-slider/date-range-slider";
import { DisplayDateAbbreviatedTimePipe } from "../../../../pipes/display-date-abbreviated-time.pipe";

@Component({
  selector: "app-email-routing-log",
  template: `
    <div class="d-flex align-items-center gap-2 mb-2">
      <app-date-range-slider class="flex-grow-1"
        [minDate]="logMinDate"
        [maxDate]="logMaxDate"
        [range]="logDateRange"
        (rangeChange)="onLogDateRangeChange($event)"/>
      <app-cloudflare-button [disabled]="loading" [loading]="loading" button
        (click)="refreshAll()"
        title="Refresh"></app-cloudflare-button>
    </div>
    @if (error) {
      <div class="d-flex align-items-center mt-2 mb-2">
        <alert type="danger" class="flex-grow-1 mb-0">
          <fa-icon [icon]="ALERT_ERROR.icon"></fa-icon>
          <strong class="ms-2">Error</strong>
          <span class="ms-2">{{ stringUtilsService.stringify(error) }}</span>
        </alert>
      </div>
    }
    <h6 class="section-heading">Email Routing Log</h6>
    @if (emailRoutingLogs?.length) {
      <div class="table-responsive" style="max-height: 400px; overflow-y: auto">
        <table class="table table-sm email-log-table">
          <thead class="sticky-top bg-white">
            <tr>
              <th class="sortable-header" (click)="sortEmailLogsBy('datetime')">
                <span class="nowrap">Date/Time
                  @if (emailLogSortField === 'datetime') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
              <th class="sortable-header" (click)="sortEmailLogsBy('from')">
                <span class="nowrap">From
                  @if (emailLogSortField === 'from') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
              <th class="sortable-header" (click)="sortEmailLogsBy('to')">
                <span class="nowrap">To
                  @if (emailLogSortField === 'to') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
              <th class="sortable-header" (click)="sortEmailLogsBy('status')">
                <span class="nowrap">Status
                  @if (emailLogSortField === 'status') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
              <th class="sortable-header" (click)="sortEmailLogsBy('spf')">
                <span class="nowrap">SPF
                  @if (emailLogSortField === 'spf') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
              <th class="sortable-header" (click)="sortEmailLogsBy('dkim')">
                <span class="nowrap">DKIM
                  @if (emailLogSortField === 'dkim') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
              <th class="sortable-header" (click)="sortEmailLogsBy('dmarc')">
                <span class="nowrap">DMARC
                  @if (emailLogSortField === 'dmarc') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
              <th class="sortable-header" (click)="sortEmailLogsBy('errorDetail')">
                <span class="nowrap">Error
                  @if (emailLogSortField === 'errorDetail') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
            </tr>
          </thead>
          @for (log of emailRoutingLogs; track log.sessionId; let even = $even) {
            <tbody [class.striped-group]="even">
              <tr>
                <td class="small text-nowrap">{{ log.datetime | displayDateAbbreviatedTime }}</td>
                <td class="small">{{ log.from }}</td>
                <td class="small">{{ log.to }}</td>
                <td><span [class]="statusBadgeClass(log.status)">{{ log.status }}</span></td>
                <td>@if (log.spf) {<span [class]="authBadgeClass(log.spf)">{{ log.spf }}</span>}</td>
                <td>@if (log.dkim) {<span [class]="authBadgeClass(log.dkim)">{{ log.dkim }}</span>}</td>
                <td>@if (log.dmarc) {<span [class]="authBadgeClass(log.dmarc)">{{ log.dmarc }}</span>}</td>
                <td class="small">{{ log.errorDetail }}</td>
              </tr>
              @if (authSummary(log)) {
                <tr>
                  <td colspan="8" class="small text-muted border-0 pt-0 pb-2">{{ authSummary(log) }}</td>
                </tr>
              }
            </tbody>
          }
        </table>
      </div>
    }
    @if (emailRoutingLogs && !emailRoutingLogs.length) {
      <div class="text-muted small">No email routing log entries found for this period</div>
    }
    @if (workerScriptName) {
      <h6 class="section-heading">Worker Invocation Log</h6>
      @if (workerLogs?.length) {
        <div class="table-responsive" style="max-height: 400px; overflow-y: auto">
          <table class="table table-sm table-striped">
            <thead class="sticky-top bg-white">
              <tr>
                <th class="sortable-header" (click)="sortWorkerLogsBy('datetime')">
                  <span class="nowrap">Date/Time
                    @if (workerLogSortField === 'datetime') {
                      <span class="sorting-header">{{ workerLogSortDirection }}</span>
                    }
                  </span>
                </th>
                <th class="sortable-header" (click)="sortWorkerLogsBy('status')">
                  <span class="nowrap">Status
                    @if (workerLogSortField === 'status') {
                      <span class="sorting-header">{{ workerLogSortDirection }}</span>
                    }
                  </span>
                </th>
                <th class="sortable-header" (click)="sortWorkerLogsBy('requests')">
                  <span class="nowrap">Requests
                    @if (workerLogSortField === 'requests') {
                      <span class="sorting-header">{{ workerLogSortDirection }}</span>
                    }
                  </span>
                </th>
                <th class="sortable-header" (click)="sortWorkerLogsBy('errors')">
                  <span class="nowrap">Errors
                    @if (workerLogSortField === 'errors') {
                      <span class="sorting-header">{{ workerLogSortDirection }}</span>
                    }
                  </span>
                </th>
                <th class="sortable-header" (click)="sortWorkerLogsBy('subrequests')">
                  <span class="nowrap">Subrequests
                    @if (workerLogSortField === 'subrequests') {
                      <span class="sorting-header">{{ workerLogSortDirection }}</span>
                    }
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              @for (log of workerLogs; track log.datetime + log.status) {
                <tr>
                  <td class="small text-nowrap">{{ log.datetime | displayDateAbbreviatedTime }}</td>
                  <td>
                    @if (log.errors > 0) {
                      <span class="badge bg-danger">{{ log.status }}</span>
                    } @else {
                      <span class="badge bg-success">{{ log.status }}</span>
                    }
                  </td>
                  <td>{{ log.requests }}</td>
                  <td>{{ log.errors }}</td>
                  <td>{{ log.subrequests }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
      @if (workerLogs && !workerLogs.length) {
        <div class="text-muted small">No worker invocation entries found for this period</div>
      }
    }`,
  styles: [`
    .sortable-header
      cursor: pointer
      user-select: none
      &:hover
        background-color: rgba(0, 0, 0, 0.05)
    .sorting-header
      font-size: 50%
    .section-heading
      border-top: 1px solid #dee2e6
      padding-top: 0.75rem
      margin: 0.75rem 0
    .auth-badge-neutral
      background-color: #adb5bd !important
      color: #fff !important
    .email-log-table tbody tr
      --bs-table-bg: #fff
    .email-log-table tbody.striped-group tr
      --bs-table-bg: #f2f2f2
    .email-log-table tbody tr td
      border-bottom: none
    .email-log-table tbody
      border-bottom: 1px solid #dee2e6
  `],
  imports: [AlertComponent, FontAwesomeModule, CloudflareButton, DateRangeSlider, DisplayDateAbbreviatedTimePipe]
})
export class EmailRoutingLogComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("EmailRoutingLogComponent", NgxLoggerLevel.ERROR);
  private cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  private dateUtils = inject(DateUtilsService);
  public stringUtilsService = inject(StringUtilsService);

  protected readonly ALERT_ERROR = ALERT_ERROR;

  @Input() roleEmail: string;
  @Input() routeType: string;
  private _workerScriptName: string;

  @Input() set workerScriptName(value: string) {
    const changed = this._workerScriptName !== value;
    this._workerScriptName = value;
    if (changed && value && this.logDateRange) {
      this.refreshWorkerLogs();
    }
  }

  get workerScriptName(): string {
    return this._workerScriptName;
  }

  emailRoutingLogs: EmailRoutingLogEntry[];
  workerLogs: WorkerInvocationSummary[];
  loading = false;
  error: any;

  logMinDate: DateTime;
  logMaxDate: DateTime;
  logDateRange: DateRange;

  emailLogSortField = "datetime";
  emailLogReverseSort = true;
  emailLogSortDirection = DESCENDING;

  workerLogSortField = "datetime";
  workerLogReverseSort = true;
  workerLogSortDirection = DESCENDING;

  ngOnInit() {
    const now = this.dateUtils.dateTimeNow();
    this.logMaxDate = now;
    this.logMinDate = now.minus({days: 30});
    this.logDateRange = {
      from: now.minus({days: 30}).toMillis(),
      to: now.toMillis()
    };
    this.refreshAll();
  }

  async refreshAll() {
    this.loading = true;
    this.error = null;
    try {
      const promises: Promise<void>[] = [this.refreshEmailRoutingLogs()];
      if (this.workerScriptName) {
        promises.push(this.refreshWorkerLogs());
      }
      await Promise.all(promises);
    } finally {
      this.loading = false;
    }
  }

  onLogDateRangeChange(range: DateRange) {
    this.logDateRange = range;
    this.refreshAll();
  }

  sortEmailLogsBy(field: string) {
    if (this.emailLogSortField === field) {
      this.emailLogReverseSort = !this.emailLogReverseSort;
    } else {
      this.emailLogSortField = field;
      this.emailLogReverseSort = false;
    }
    this.emailLogSortDirection = this.emailLogReverseSort ? DESCENDING : ASCENDING;
    this.applySortToEmailLogs();
  }

  sortWorkerLogsBy(field: string) {
    if (this.workerLogSortField === field) {
      this.workerLogReverseSort = !this.workerLogReverseSort;
    } else {
      this.workerLogSortField = field;
      this.workerLogReverseSort = false;
    }
    this.workerLogSortDirection = this.workerLogReverseSort ? DESCENDING : ASCENDING;
    this.applySortToWorkerLogs();
  }

  private applySortToEmailLogs() {
    if (this.emailRoutingLogs?.length) {
      const sorted = sortBy(this.emailRoutingLogs, [this.emailLogSortField]);
      this.emailRoutingLogs = this.emailLogReverseSort ? sorted.reverse() : sorted;
    }
  }

  private applySortToWorkerLogs() {
    if (this.workerLogs?.length) {
      const sorted = sortBy(this.workerLogs, [this.workerLogSortField]);
      this.workerLogs = this.workerLogReverseSort ? sorted.reverse() : sorted;
    }
  }

  private async refreshEmailRoutingLogs() {
    const fromDate = DateTime.fromMillis(this.logDateRange.from);
    const toDate = DateTime.fromMillis(this.logDateRange.to);
    try {
      this.emailRoutingLogs = await this.cloudflareEmailRoutingService.queryEmailRoutingLogs({
        startDate: fromDate.toISO(),
        endDate: toDate.toISO(),
        recipientEmail: this.roleEmail,
        limit: 100
      });
      this.applySortToEmailLogs();
    } catch (err) {
      this.error = this.friendlyError(err);
    }
  }

  private async refreshWorkerLogs() {
    const fromDate = DateTime.fromMillis(this.logDateRange.from);
    const toDate = DateTime.fromMillis(this.logDateRange.to);
    try {
      this.workerLogs = await this.cloudflareEmailRoutingService.queryWorkerLogs({
        startDate: fromDate.toISO(),
        endDate: toDate.toISO(),
        scriptName: this.workerScriptName,
        limit: 100
      });
      this.applySortToWorkerLogs();
    } catch (err) {
      this.error = this.friendlyError(err);
    }
  }

  statusBadgeClass(status: string): string {
    if (status === EmailRoutingLogStatus.FORWARDED || status === EmailRoutingLogStatus.DELIVERED) {
      return "badge bg-success";
    } else if (status === EmailRoutingLogStatus.DROPPED && this.routeType === "worker") {
      return "badge bg-success";
    } else if (status === EmailRoutingLogStatus.REJECTED || status === EmailRoutingLogStatus.DELIVERY_FAILED) {
      return "badge bg-danger";
    } else if (status === EmailRoutingLogStatus.DROPPED) {
      return "badge bg-warning";
    } else {
      return "badge text-style-sunset";
    }
  }

  authBadgeClass(value: string): string {
    const lower = (value || "").toLowerCase();
    if (lower === EmailAuthResult.PASS) {
      return "badge bg-success";
    } else if (lower === EmailAuthResult.FAIL || lower === EmailAuthResult.HARDFAIL) {
      return "badge bg-danger";
    } else if (lower === EmailAuthResult.SOFTFAIL) {
      return "badge bg-warning text-dark";
    } else {
      return "badge auth-badge-neutral";
    }
  }

  authSummary(log: EmailRoutingLogEntry): string {
    const spf = (log.spf || "").toLowerCase();
    const dkim = (log.dkim || "").toLowerCase();
    const dmarc = (log.dmarc || "").toLowerCase();
    const status = log.status;
    const isWorkerRoute = this.routeType === "worker";

    if (status === EmailRoutingLogStatus.DROPPED && isWorkerRoute) {
      if (spf === EmailAuthResult.PASS && dkim === EmailAuthResult.PASS) {
        return "Handed off to worker for forwarding — authentication passed";
      } else {
        return "Handed off to worker for forwarding";
      }
    }

    if (status === EmailRoutingLogStatus.FORWARDED || status === EmailRoutingLogStatus.DELIVERED) {
      if (spf === EmailAuthResult.PASS && dkim === EmailAuthResult.PASS && dmarc === EmailAuthResult.PASS) {
        return "Fully authenticated and delivered";
      } else if (spf === EmailAuthResult.PASS && dkim === EmailAuthResult.PASS) {
        return "Delivered — SPF and DKIM passed but no DMARC policy on sender domain";
      } else {
        return "Delivered despite incomplete authentication";
      }
    }

    const failures: string[] = [];
    if (spf === EmailAuthResult.FAIL || spf === EmailAuthResult.HARDFAIL) {
      failures.push("SPF failed — sender IP not authorised for this domain");
    } else if (spf === EmailAuthResult.SOFTFAIL) {
      failures.push("SPF soft-failed — sender IP not explicitly authorised");
    }
    if (dkim === EmailAuthResult.FAIL) {
      failures.push("DKIM failed — email signature could not be verified");
    }
    if (dmarc === EmailAuthResult.FAIL) {
      failures.push("DMARC failed — sender domain policy rejected this email");
    }
    if (failures.length > 0) {
      return failures.join(". ");
    }

    if (status === EmailRoutingLogStatus.DROPPED) {
      return log.errorDetail || "Email was dropped — check worker logs for details";
    }
    if (status === EmailRoutingLogStatus.REJECTED) {
      return "Email was rejected by the routing rule";
    }

    return "";
  }

  private friendlyError(err: any): string {
    const raw = err?.error?.error?.message || err?.error?.message || err?.message || err?.toString() || "Unknown error";
    if (raw.includes("time range is too large") || raw.includes("2678400")) {
      return "Date range too wide — Cloudflare allows a maximum of 30 days. Please narrow your selection.";
    }
    return raw;
  }
}
