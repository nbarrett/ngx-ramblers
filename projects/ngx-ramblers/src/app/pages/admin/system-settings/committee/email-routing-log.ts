import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, HostListener, inject, Input, NgZone, OnDestroy, OnInit, ViewChild } from "@angular/core";
import { NgxLoggerLevel } from "ngx-logger";
import { DateTime } from "luxon";
import { DESCENDING } from "../../../../models/table-filtering.model";
import {
  EmailAuthResult,
  EmailRoutingLogEntry,
  EmailRoutingLogStatus,
  EmailRoutingLogView,
  WorkerInvocationSummary
} from "../../../../models/cloudflare-email-routing.model";
import { SectionToggle } from "../../../../shared/components/section-toggle";
import { SectionToggleTab } from "../../../../models/section-toggle.model";
import { StoredValue } from "../../../../models/ui-actions";
import { CloudflareEmailRoutingService } from "../../../../services/cloudflare/cloudflare-email-routing.service";
import { DateUtilsService } from "../../../../services/date-utils.service";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { ALERT_ERROR } from "../../../../models/alert-target.model";
import { AlertComponent } from "ngx-bootstrap/alert";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { CloudflareButton } from "../../../../modules/common/third-parties/cloudflare-button";
import { DateRange, DateRangeSlider } from "../../../../components/date-range-slider/date-range-slider";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { SortableTableComponent } from "../../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective, SortableTableExpandedRowDirective } from "../../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableAlignment, SortableTableColumn } from "../../../../modules/common/sortable-table/sortable-table.model";

@Component({
  selector: "app-email-routing-log",
  template: `
    <div class="d-flex align-items-center gap-2 mb-3">
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
    <div class="mt-2 mb-3">
      <app-section-toggle fullWidth stackOnMobile
        [tabs]="logViewTabs"
        [selectedTab]="logView"
        [queryParamKey]="StoredValue.EMAIL_LOG_VIEW"
        (selectedTabChange)="onLogViewChange($event)"/>
    </div>
    @if (logView === EmailRoutingLogView.ROUTING) {
      @if (hasUniformMissingDmarcSummary()) {
        <div class="alert alert-warning py-2 small mb-2">
          All displayed messages were delivered with SPF and DKIM passing, but no DMARC policy was reported for the sender domain.
        </div>
      }
      <div #logScroll class="email-log-scroll" [style.max-height]="logScrollMaxHeight" [style.height]="logScrollMaxHeight">
        <app-sortable-table
          [columns]="emailLogColumns"
          [rows]="emailRoutingLogs || []"
          [defaultSortKey]="'datetime'"
          [defaultSortDirection]="DESCENDING"
          [maxHeight]="logScrollMaxHeight"
          freezeFirstColumn
          resizableColumns
          flat
          [expandedWhen]="emailRowExpanded"
          [trackBy]="trackEmailLog"
          emptyMessage="No email routing log entries found for this period">
          <ng-template appSortableTableCell="datetime" let-row>{{ displayLogDateTime(row.datetime) }}</ng-template>
          <ng-template appSortableTableCell="from" let-row>
            <span [tooltip]="row.from" container="body">{{ compactAddress(row.from) }}</span>
          </ng-template>
          <ng-template appSortableTableCell="to" let-row>
            <span [tooltip]="row.to" container="body">{{ compactAddress(row.to) }}</span>
          </ng-template>
          <ng-template appSortableTableCell="subject" let-row>
            <span [tooltip]="row.subject" container="body">{{ row.subject }}</span>
          </ng-template>
          <ng-template appSortableTableCell="status" let-row>
            <span [class]="statusBadgeClass(row)" [tooltip]="authSummary(row) || null" container="body">{{ row.status }}</span>
          </ng-template>
          <ng-template appSortableTableCell="spf" let-row>
            @if (row.spf) {
              <span [class]="authBadgeClass(row.spf)">{{ row.spf }}</span>
            }
          </ng-template>
          <ng-template appSortableTableCell="dkim" let-row>
            @if (row.dkim) {
              <span [class]="authBadgeClass(row.dkim)">{{ row.dkim }}</span>
            }
          </ng-template>
          <ng-template appSortableTableCell="dmarc" let-row>
            @if (row.dmarc) {
              <span [class]="authBadgeClass(row.dmarc)">{{ row.dmarc }}</span>
            }
          </ng-template>
          <ng-template appSortableTableExpandedRow let-row>
            <div class="small text-muted">{{ authSummary(row) }}</div>
          </ng-template>
        </app-sortable-table>
      </div>
    }
    @if (logView === EmailRoutingLogView.WORKER) {
      <div #logScroll class="email-log-scroll" [style.max-height]="logScrollMaxHeight" [style.height]="logScrollMaxHeight">
        <app-sortable-table
          [columns]="workerLogColumns"
          [rows]="workerLogs || []"
          [defaultSortKey]="'datetime'"
          [defaultSortDirection]="DESCENDING"
          [maxHeight]="logScrollMaxHeight"
          freezeFirstColumn
          resizableColumns
          flat
          [trackBy]="trackWorkerLog"
          emptyMessage="No worker invocation entries found for this period">
          <ng-template appSortableTableCell="datetime" let-row>{{ displayLogDateTime(row.datetime) }}</ng-template>
          <ng-template appSortableTableCell="status" let-row>
            @if (row.errors > 0) {
              <span class="badge bg-danger">{{ row.status }}</span>
            } @else {
              <span class="badge bg-success">{{ row.status }}</span>
            }
          </ng-template>
        </app-sortable-table>
      </div>
    }`,
  styles: [`
    .auth-badge-neutral
      background-color: #adb5bd !important
      color: #fff !important
    .email-log-scroll
      min-height: 200px
      max-height: calc(100dvh - 32rem)
      overflow: auto
    :host ::ng-deep .email-log-scroll .sortable-table-card
      min-height: 100%
      height: 100%
      max-height: 100%
  `],
  imports: [AlertComponent, FontAwesomeModule, CloudflareButton, DateRangeSlider, SectionToggle, TooltipDirective, SortableTableComponent, SortableTableCellDirective, SortableTableExpandedRowDirective]
})
export class EmailRoutingLogComponent implements OnInit, AfterViewInit, OnDestroy {

  private logger: Logger = inject(LoggerFactory).createLogger("EmailRoutingLogComponent", NgxLoggerLevel.ERROR);
  private cloudflareEmailRoutingService = inject(CloudflareEmailRoutingService);
  private dateUtils = inject(DateUtilsService);
  private host = inject(ElementRef<HTMLElement>);
  private zone = inject(NgZone);
  private changeDetector = inject(ChangeDetectorRef);
  public stringUtilsService = inject(StringUtilsService);

  protected readonly ALERT_ERROR = ALERT_ERROR;
  protected readonly EmailRoutingLogView = EmailRoutingLogView;
  protected readonly StoredValue = StoredValue;
  protected readonly DESCENDING = DESCENDING;
  logView: EmailRoutingLogView = EmailRoutingLogView.ROUTING;
  logViewTabs: SectionToggleTab[] = [
    {value: EmailRoutingLogView.ROUTING, label: "Email Routing Log"},
    {value: EmailRoutingLogView.WORKER, label: "Worker Invocation Log"}
  ];
  @ViewChild("logScroll") logScroll: ElementRef<HTMLElement>;
  logScrollMaxHeightPx = 0;
  emailLogColumns: SortableTableColumn<EmailRoutingLogEntry>[] = [
    {key: "datetime", label: "Date/Time (UK)", sortKey: "datetime", width: "11rem", cellClass: "text-nowrap"},
    {key: "from", label: "From", sortKey: "from", width: "16rem", cellClass: "compact-cell"},
    {key: "to", label: "To", sortKey: "to", width: "16rem", cellClass: "compact-cell"},
    {key: "subject", label: "Subject", sortKey: "subject", width: "18rem", cellClass: "compact-cell"},
    {key: "status", label: "Status", sortKey: "status", align: SortableTableAlignment.CENTER, cellClass: "text-nowrap"},
    {key: "spf", label: "SPF", sortKey: "spf", align: SortableTableAlignment.CENTER, cellClass: "text-nowrap"},
    {key: "dkim", label: "DKIM", sortKey: "dkim", align: SortableTableAlignment.CENTER, cellClass: "text-nowrap"},
    {key: "dmarc", label: "DMARC", sortKey: "dmarc", align: SortableTableAlignment.CENTER, cellClass: "text-nowrap"}
  ];
  workerLogColumns: SortableTableColumn<WorkerInvocationSummary>[] = [
    {key: "datetime", label: "Date/Time (UK)", sortKey: "datetime", width: "11rem", cellClass: "text-nowrap"},
    {key: "status", label: "Status", sortKey: "status"},
    {key: "requests", label: "Requests", sortKey: "requests", cellGetter: row => row.requests},
    {key: "errors", label: "Errors", sortKey: "errors", cellGetter: row => row.errors},
    {key: "subrequests", label: "Subrequests", sortKey: "subrequests", cellGetter: row => row.subrequests}
  ];
  private readonly missingDmarcSummary = "Delivered - SPF and DKIM passed but no DMARC policy on sender domain";

  get logScrollMaxHeight(): string {
    if (this.logScrollMaxHeightPx > 0) {
      return `${this.logScrollMaxHeightPx}px`;
    } else {
      return "calc(100dvh - 32rem)";
    }
  }

  trackEmailLog = (_index: number, row: EmailRoutingLogEntry) => row.sessionId;
  trackWorkerLog = (_index: number, row: WorkerInvocationSummary) => `${row.datetime}-${row.status}`;
  emailRowExpanded = (row: EmailRoutingLogEntry) => {
    const summary = this.authSummary(row);
    return !!summary && !(this.hasUniformMissingDmarcSummary() && summary === this.missingDmarcSummary);
  };

  @Input() roleEmail: string;
  @Input() recipientEmails: string[] = [];
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

  private readonly onViewportChange = () => this.fitLogScroll();
  private resizeObserver: ResizeObserver = null;

  ngOnInit() {
    this.refreshAll();
  }

  ngAfterViewInit(): void {
    this.fitLogScroll();
    this.resizeObserver = new ResizeObserver(() => this.zone.run(() => this.fitLogScroll()));
    this.resizeObserver.observe(this.host.nativeElement);
    window.visualViewport?.addEventListener("resize", this.onViewportChange);
    window.visualViewport?.addEventListener("scroll", this.onViewportChange);
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    window.visualViewport?.removeEventListener("resize", this.onViewportChange);
    window.visualViewport?.removeEventListener("scroll", this.onViewportChange);
  }

  @HostListener("window:resize")
  fitLogScroll(): void {
    const el = this.logScroll?.nativeElement;
    if (el) {
      const tableBox = el.getBoundingClientRect();
      if (tableBox.width > 0) {
        const page = this.host.nativeElement.closest("app-committee-settings") || document;
        const saveBar = page.querySelector("app-form-save-actions");
        const saveBox = saveBar?.getBoundingClientRect();
        const saveHeight = saveBox?.height || 48;
        const gapBelowTable = saveBox ? Math.max(8, Math.round(saveBox.top - tableBox.bottom)) : 16;
        const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
        const chromeBelow = saveHeight + gapBelowTable + 16;
        const next = Math.max(200, Math.floor(viewportHeight - tableBox.top - chromeBelow));
        if (next !== this.logScrollMaxHeightPx) {
          this.logScrollMaxHeightPx = next;
          this.changeDetector.detectChanges();
        }
      }
    }
  }

  onLogViewChange(view: EmailRoutingLogView): void {
    this.logView = view;
    setTimeout(() => this.fitLogScroll());
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
      setTimeout(() => this.fitLogScroll());
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

  private async refreshEmailRoutingLogs() {
    const fromDate = this.dateUtils.asDateTime(this.logDateRange.from);
    const toDate = this.dateUtils.asDateTime(this.logDateRange.to);
    try {
      const recipients = (this.recipientEmails?.length ? this.recipientEmails : [this.roleEmail]).filter(Boolean);
      if (recipients.length === 0) {
        this.emailRoutingLogs = await this.cloudflareEmailRoutingService.queryEmailRoutingLogs({
          startDate: fromDate.toISO(),
          endDate: toDate.toISO(),
          limit: 100
        });
      } else {
        const batches = await Promise.all(recipients.map(recipientEmail => this.cloudflareEmailRoutingService.queryEmailRoutingLogs({
          startDate: fromDate.toISO(),
          endDate: toDate.toISO(),
          recipientEmail,
          limit: 100
        })));
        const seen = new Set<string>();
        this.emailRoutingLogs = batches.flat().filter(entry => {
          const key = entry.sessionId || `${entry.datetime}|${entry.to}|${entry.subject}`;
          const unseen = !seen.has(key);
          if (unseen) {
            seen.add(key);
          }
          return unseen;
        });
      }
    } catch (err) {
      this.error = this.friendlyError(err);
    }
  }

  private async refreshWorkerLogs() {
    const fromDate = this.dateUtils.asDateTime(this.logDateRange.from);
    const toDate = this.dateUtils.asDateTime(this.logDateRange.to);
    try {
      this.workerLogs = await this.cloudflareEmailRoutingService.queryWorkerLogs({
        startDate: fromDate.toISO(),
        endDate: toDate.toISO(),
        scriptName: this.workerScriptName,
        limit: 100
      });
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

  compactAddress(value: string): string {
    const match = (value || "").match(/<([^>]+)>/);
    return match ? match[1] : value;
  }

  hasUniformMissingDmarcSummary(): boolean {
    return this.emailRoutingLogs?.length > 1 && this.emailRoutingLogs.every(log => this.authSummary(log) === this.missingDmarcSummary);
  }

  authSummary(log: EmailRoutingLogEntry): string {
    const spf = (log.spf || "").toLowerCase();
    const dkim = (log.dkim || "").toLowerCase();
    const dmarc = (log.dmarc || "").toLowerCase();
    const status = log.status;
    const isWorkerRoute = this.routeType === "worker";
    const failures: string[] = [];
    if (spf === EmailAuthResult.FAIL || spf === EmailAuthResult.HARDFAIL) {
      failures.push("SPF failed - sender IP not authorised for this domain");
    } else if (spf === EmailAuthResult.SOFTFAIL) {
      failures.push("SPF soft-failed - sender IP not explicitly authorised");
    }
    if (dkim === EmailAuthResult.FAIL) {
      failures.push("DKIM failed - email signature could not be verified");
    }
    if (dmarc === EmailAuthResult.FAIL) {
      failures.push("DMARC failed - sender domain policy rejected this email");
    }
    if (failures.length > 0) {
      return failures.join(". ");
    } else if (status === EmailRoutingLogStatus.DROPPED && isWorkerRoute) {
      if (this.workerErrorNear(log.datetime)) {
        return "Worker invocation failed for this message - see Worker Invocation Log. Mail to this address will not have been delivered.";
      } else if (spf === EmailAuthResult.PASS && dkim === EmailAuthResult.PASS) {
        return "Handed off to worker for forwarding - authentication passed";
      } else {
        return "Handed off to worker for forwarding";
      }
    } else if (status === EmailRoutingLogStatus.FORWARDED || status === EmailRoutingLogStatus.DELIVERED) {
      if (spf === EmailAuthResult.PASS && dkim === EmailAuthResult.PASS && dmarc === EmailAuthResult.PASS) {
        return "Fully authenticated and delivered";
      } else if (spf === EmailAuthResult.PASS && dkim === EmailAuthResult.PASS) {
        return this.missingDmarcSummary;
      } else {
        return "Delivered despite incomplete authentication";
      }
    } else if (status === EmailRoutingLogStatus.DROPPED) {
      return log.errorDetail || "Email was dropped - check worker logs for details";
    } else if (status === EmailRoutingLogStatus.REJECTED) {
      return "Email was rejected by the routing rule";
    } else {
      return "";
    }
  }

  private workerErrorNear(emailDateTime: string): boolean {
    if (!this.workerLogs?.length || !emailDateTime) {
      return false;
    }
    const emailTime = this.dateUtils.asDateTime(emailDateTime);
    if (!emailTime.isValid) {
      return false;
    }
    return this.workerLogs.some(workerLog => {
      if (!workerLog.errors || workerLog.errors <= 0) {
        return false;
      }
      const workerTime = this.dateUtils.asDateTime(workerLog.datetime);
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
