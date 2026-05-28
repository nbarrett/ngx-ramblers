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
      @if (hasUniformMissingDmarcSummary()) {
        <div class="alert alert-warning py-2 small mb-2">
          All displayed messages were delivered with SPF and DKIM passing, but no DMARC policy was reported for the sender domain.
        </div>
      }
      <div class="table-responsive" style="max-height: 400px; overflow-y: auto">
        <table class="table table-sm email-log-table">
          <thead class="sticky-top bg-white">
            <tr>
              <th class="sortable-header" (click)="sortEmailLogsBy('datetime')">
                <span class="nowrap">Date/Time (UK)
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
              <th class="sortable-header" (click)="sortEmailLogsBy('subject')">
                <span class="nowrap">Subject
                  @if (emailLogSortField === 'subject') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
              <th class="sortable-header badge-column" (click)="sortEmailLogsBy('status')">
                <span class="nowrap">Status
                  @if (emailLogSortField === 'status') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
              <th class="sortable-header badge-column" (click)="sortEmailLogsBy('spf')">
                <span class="nowrap">SPF
                  @if (emailLogSortField === 'spf') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
              <th class="sortable-header badge-column" (click)="sortEmailLogsBy('dkim')">
                <span class="nowrap">DKIM
                  @if (emailLogSortField === 'dkim') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
              <th class="sortable-header badge-column" (click)="sortEmailLogsBy('dmarc')">
                <span class="nowrap">DMARC
                  @if (emailLogSortField === 'dmarc') {
                    <span class="sorting-header">{{ emailLogSortDirection }}</span>
                  }
                </span>
              </th>
              <th class="sortable-header error-column" (click)="sortEmailLogsBy('errorDetail')">
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
                <td class="small text-nowrap">{{ displayLogDateTime(log.datetime) }}</td>
                <td class="small">{{ log.from }}</td>
                <td class="small">{{ log.to }}</td>
                <td class="small">{{ log.subject }}</td>
                <td class="badge-column"><span [class]="statusBadgeClass(log)">{{ log.status }}</span></td>
                <td class="badge-column">@if (log.spf) {<span [class]="authBadgeClass(log.spf)">{{ log.spf }}</span>}</td>
                <td class="badge-column">@if (log.dkim) {<span [class]="authBadgeClass(log.dkim)">{{ log.dkim }}</span>}</td>
                <td class="badge-column">@if (log.dmarc) {<span [class]="authBadgeClass(log.dmarc)">{{ log.dmarc }}</span>}</td>
                <td class="small error-column">{{ log.errorDetail }}</td>
              </tr>
              @if (showAuthSummary(log)) {
                <tr>
                  <td colspan="9" class="small text-muted border-0 pt-0 pb-2">{{ authSummary(log) }}</td>
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
                  <span class="nowrap">Date/Time (UK)
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
                  <td class="small text-nowrap">{{ displayLogDateTime(log.datetime) }}</td>
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
    .email-log-table .badge-column
      min-width: 4.75rem
      padding-left: 0.5rem
      padding-right: 0.5rem
      text-align: center
      white-space: nowrap
    .email-log-table .error-column
      padding-left: 0.75rem
    .email-log-table tbody tr
      --bs-table-bg: #fff
    .email-log-table tbody.striped-group tr
      --bs-table-bg: #f2f2f2
    .email-log-table tbody tr td
      border-bottom: none
    .email-log-table tbody
      border-bottom: 1px solid #dee2e6
  `],
  imports: [AlertComponent, FontAwesomeModule, CloudflareButton, DateRangeSlider]
})
export class EmailRoutingLogComponent implements OnInit {

  private logger: Logger = inject(LoggerFactory).createLogger("EmailRoutingLogComponent", NgxLoggerLevel.ERROR);
  private cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  private dateUtils = inject(DateUtilsService);
  public stringUtilsService = inject(StringUtilsService);

  protected readonly ALERT_ERROR = ALERT_ERROR;
  private readonly missingDmarcSummary = "Delivered - SPF and DKIM passed but no DMARC policy on sender domain";

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
    this.refreshAll();
  }

  async refreshAll() {
    this.loading = true;
    this.error = null;
    try {
      this.advanceDateBoundsToNow();
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

  private advanceDateBoundsToNow() {
    const previousMaxMillis = this.logMaxDate?.toMillis();
    const previousMinMillis = this.logMinDate?.toMillis();
    const toPinnedToMax = this.logDateRange?.to === previousMaxMillis;
    const fromPinnedToMin = this.logDateRange?.from === previousMinMillis;
    const now = this.dateUtils.dateTimeNow();
    this.logMaxDate = now;
    this.logMinDate = now.minus({days: 30});
    if (!this.logDateRange) {
      this.logDateRange = {from: this.logMinDate.toMillis(), to: this.logMaxDate.toMillis()};
      return;
    }
    this.logDateRange = {
      from: fromPinnedToMin ? this.logMinDate.toMillis() : this.logDateRange.from,
      to: toPinnedToMax ? this.logMaxDate.toMillis() : this.logDateRange.to
    };
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

  statusBadgeClass(log: EmailRoutingLogEntry): string {
    const status = log.status;
    if (status === EmailRoutingLogStatus.FORWARDED || status === EmailRoutingLogStatus.DELIVERED) {
      return "badge bg-success";
    } else if (status === EmailRoutingLogStatus.DROPPED && this.routeType === "worker") {
      return this.workerErrorNear(log.datetime) ? "badge bg-danger" : "badge bg-success";
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

  displayLogDateTime(dateValue: string): string {
    return this.dateUtils.displayDateAbbreviatedTimeZone(dateValue);
  }

  hasUniformMissingDmarcSummary(): boolean {
    return this.emailRoutingLogs?.length > 1 && this.emailRoutingLogs.every(log => this.authSummary(log) === this.missingDmarcSummary);
  }

  showAuthSummary(log: EmailRoutingLogEntry): boolean {
    const summary = this.authSummary(log);
    return !!summary && !(this.hasUniformMissingDmarcSummary() && summary === this.missingDmarcSummary);
  }

  authSummary(log: EmailRoutingLogEntry): string {
    const spf = (log.spf || "").toLowerCase();
    const dkim = (log.dkim || "").toLowerCase();
    const dmarc = (log.dmarc || "").toLowerCase();
    const status = log.status;
    const isWorkerRoute = this.routeType === "worker";

    if (status === EmailRoutingLogStatus.DROPPED && isWorkerRoute) {
      if (this.workerErrorNear(log.datetime)) {
        return "Worker invocation failed for this message - see Worker Invocation Log below. Mail to this address will not have been delivered.";
      }
      if (spf === EmailAuthResult.PASS && dkim === EmailAuthResult.PASS) {
        return "Handed off to worker for forwarding - authentication passed";
      } else {
        return "Handed off to worker for forwarding";
      }
    }

    if (status === EmailRoutingLogStatus.FORWARDED || status === EmailRoutingLogStatus.DELIVERED) {
      if (spf === EmailAuthResult.PASS && dkim === EmailAuthResult.PASS && dmarc === EmailAuthResult.PASS) {
        return "Fully authenticated and delivered";
      } else if (spf === EmailAuthResult.PASS && dkim === EmailAuthResult.PASS) {
        return this.missingDmarcSummary;
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

  private workerErrorNear(emailDateTime: string): boolean {
    if (!this.workerLogs?.length || !emailDateTime) {
      return false;
    }
    const emailTime = DateTime.fromISO(emailDateTime);
    if (!emailTime.isValid) {
      return false;
    }
    return this.workerLogs.some(workerLog => {
      if (!workerLog.errors || workerLog.errors <= 0) {
        return false;
      }
      const workerTime = DateTime.fromISO(workerLog.datetime);
      if (!workerTime.isValid) {
        return false;
      }
      return Math.abs(emailTime.diff(workerTime, "minutes").minutes) < 2;
    });
  }

  private friendlyError(err: any): string {
    const raw = err?.error?.error?.message || err?.error?.message || err?.message || err?.toString() || "Unknown error";
    if (raw.includes("time range is too large") || raw.includes("2678400")) {
      return "Date range too wide — Cloudflare allows a maximum of 30 days. Please narrow your selection.";
    }
    return raw;
  }
}
