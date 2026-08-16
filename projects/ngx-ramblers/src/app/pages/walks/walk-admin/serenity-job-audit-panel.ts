import { ChangeDetectorRef, Component, inject, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleCheck } from "@fortawesome/free-solid-svg-icons";
import { isArray } from "es-toolkit/compat";
import { Subscription } from "rxjs";
import { sortBy } from "../../../functions/arrays";
import { openSerenityReport } from "../../../functions/serenity-report";
import { RamblersUploadAudit, Status } from "../../../models/ramblers-upload-audit.model";
import { SortDirection } from "../../../models/sort.model";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { StoredValue } from "../../../models/ui-actions";
import { MessageType, RamblersUploadAuditProgressResponse } from "../../../models/websocket.model";
import { SortableTableCellDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { DisplayTimeWithSecondsPipe } from "../../../pipes/display-time.pipe-with-seconds";
import { ValueOrDefaultPipe } from "../../../pipes/value-or-default.pipe";
import { DateUtilsService } from "../../../services/date-utils.service";
import { StringUtilsService } from "../../../services/string-utils.service";
import { UiActionsService } from "../../../services/ui-actions.service";
import { UrlService } from "../../../services/url.service";
import { RamblersUploadAuditService } from "../../../services/walks/ramblers-upload-audit.service";
import { WebSocketClientService } from "../../../services/websockets/websocket-client.service";
import { StatusIconComponent } from "../../admin/status-icon";

@Component({
  selector: "app-serenity-job-audit-panel",
  imports: [FontAwesomeModule, DisplayTimeWithSecondsPipe, ValueOrDefaultPipe, StatusIconComponent, SortableTableComponent, SortableTableCellDirective],
  template: `
    <div class="thumbnail-heading-frame">
      <div class="thumbnail-heading">Job progress</div>
      @if (latestAudit) {
        <p class="mb-2">
          <app-status-icon noLabel [status]="latestAudit.status"/>
          <strong class="ms-2">{{ latestAudit.message }}</strong>
        </p>
      }
      @if (reportAudit) {
        <div class="mb-2">
          <button type="button" class="btn btn-primary" (click)="openReport($event)">
            <fa-icon [icon]="faCircleCheck" class="me-2"/>
            View report
          </button>
        </div>
      }
      <app-sortable-table
        [columns]="columns"
        [rows]="audits"
        [defaultSortKey]="sortKey"
        [defaultSortDirection]="sortDirection"
        [trackBy]="trackAudit"
        (sortChange)="onSortChange($event)"
        emptyMessage="Waiting for the job to start…">
        <ng-template appSortableTableCell="status" let-row>
          <app-status-icon noLabel [status]="displayStatus(row)"/>
        </ng-template>
        <ng-template appSortableTableCell="auditTime" let-row>
          {{ row.auditTime | displayTimeWithSeconds }}
        </ng-template>
        <ng-template appSortableTableCell="durationMs" let-row>
          {{ timing(row) }}
        </ng-template>
        <ng-template appSortableTableCell="message" let-row>
          {{ row.message }}@if (row.errorResponse) {
            <div>: {{ row.errorResponse | valueOrDefault }}</div>
          }
        </ng-template>
      </app-sortable-table>
    </div>
  `
})
export class SerenityJobAuditPanelComponent implements OnInit, OnChanges, OnDestroy {
  private webSocketClientService = inject(WebSocketClientService);
  private ramblersUploadAuditService = inject(RamblersUploadAuditService);
  private urlService = inject(UrlService);
  private dateUtils = inject(DateUtilsService);
  private uiActions = inject(UiActionsService);
  private stringUtils = inject(StringUtilsService);
  private activatedRoute = inject(ActivatedRoute);
  private changeDetector = inject(ChangeDetectorRef);
  private subscriptions: Subscription[] = [];
  private refresh = {intervalId: null as ReturnType<typeof setInterval> | null};
  faCircleCheck = faCircleCheck;
  audits: RamblersUploadAudit[] = [];
  reportAudit: RamblersUploadAudit | null = null;
  latestAudit: RamblersUploadAudit | null = null;
  sortKey = "auditTime";
  sortDirection = DESCENDING;
  columns: SortableTableColumn<RamblersUploadAudit>[] = [
    {key: "status", label: "Status", sortKey: "status"},
    {key: "auditTime", label: "Time", sortKey: "auditTime", cellClass: "nowrap"},
    {key: "durationMs", label: "Duration", sortKey: "durationMs", cellClass: "nowrap"},
    {key: "message", label: "Audit Message", sortKey: "message"}
  ];
  @Input() fileName: string | null = null;

  ngOnInit(): void {
    void this.webSocketClientService.connect();
    this.subscriptions.push(this.webSocketClientService.receiveMessages<RamblersUploadAuditProgressResponse>(MessageType.PROGRESS).subscribe(progress => {
      this.appendAudits(progress?.audits || []);
      void this.refreshFromApi();
    }));
    this.subscriptions.push(this.webSocketClientService.receiveMessages<RamblersUploadAuditProgressResponse>(MessageType.COMPLETE).subscribe(progress => {
      this.appendAudits(progress?.audits || []);
      void this.refreshFromApi();
      this.stopRefreshLoop();
    }));
    this.startRefreshLoop();
    this.subscriptions.push(this.activatedRoute.queryParamMap.subscribe(params => {
      this.applySortFromUrl(params.get(StoredValue.AUDIT_SORT), params.get(StoredValue.AUDIT_SORT_ORDER));
    }));
    void this.refreshFromApi();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.fileName) {
      void this.refreshFromApi();
      this.startRefreshLoop();
    }
  }

  ngOnDestroy(): void {
    this.stopRefreshLoop();
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  openReport(event: MouseEvent): void {
    if (this.reportAudit) {
      openSerenityReport(this.reportAudit, event, this.urlService);
    }
  }

  timing(audit: RamblersUploadAudit): string {
    if (audit.durationMs || audit.durationMs === 0) {
      return this.dateUtils.formatDuration(0, audit.durationMs);
    } else {
      const chronologicalAll = this.audits.slice().sort(sortBy("-auditTime", "-record"));
      const currentIndex = chronologicalAll.findIndex(item => item.id === audit.id);
      const previousAudit = chronologicalAll[currentIndex + 1];
      return this.dateUtils.formatDuration(previousAudit?.auditTime, audit?.auditTime);
    }
  }

  displayStatus(audit: RamblersUploadAudit): Status {
    return audit?.errorResponse ? Status.ERROR : audit?.status;
  }

  trackAudit(_index: number, audit: RamblersUploadAudit): string {
    return audit.id || `${audit.fileName}-${audit.record}`;
  }

  onSortChange(state: SortableTableSortState): void {
    this.sortKey = state.key || "auditTime";
    this.sortDirection = state.direction === ASCENDING ? ASCENDING : DESCENDING;
    this.uiActions.updateQueryParameters({
      [StoredValue.AUDIT_SORT]: this.sortKey ? this.stringUtils.kebabCase(this.sortKey) : null,
      [StoredValue.AUDIT_SORT_ORDER]: this.sortDirection === DESCENDING ? SortDirection.DESC : SortDirection.ASC
    });
  }

  private applySortFromUrl(sortParam: string | null, sortOrderParam: string | null): void {
    const matchedSortKey = this.columns
      .map(column => column.sortKey)
      .filter(Boolean)
      .find(key => this.stringUtils.kebabCase(key) === sortParam);
    if (matchedSortKey) {
      this.sortKey = matchedSortKey;
    }
    if (sortOrderParam === SortDirection.ASC) {
      this.sortDirection = ASCENDING;
    } else if (sortOrderParam === SortDirection.DESC) {
      this.sortDirection = DESCENDING;
    }
  }

  private startRefreshLoop(): void {
    if (!this.refresh.intervalId) {
      this.refresh.intervalId = setInterval(() => {
        void this.refreshFromApi();
      }, 2000);
    }
  }

  private stopRefreshLoop(): void {
    if (this.refresh.intervalId) {
      clearInterval(this.refresh.intervalId);
      this.refresh.intervalId = null;
    }
  }

  private async refreshFromApi(): Promise<void> {
    if (this.fileName) {
      try {
        const auditItems = await this.ramblersUploadAuditService.all({
          criteria: {fileName: this.fileName},
          sort: {auditTime: -1, record: -1},
          limit: 200
        });
        const response = auditItems.response;
        if (isArray(response)) {
          this.applyAudits(response);
        }
      } catch {
        this.changeDetector.detectChanges();
      }
    }
  }

  private appendAudits(incoming: RamblersUploadAudit[]): void {
    const matching = this.fileName
      ? incoming.filter(audit => !audit.fileName || audit.fileName === this.fileName)
      : incoming;
    if (matching.length > 0) {
      this.applyAudits(this.audits.concat(matching));
    }
  }

  private withDurations(audits: RamblersUploadAudit[]): RamblersUploadAudit[] {
    const chronological = audits.slice().sort(sortBy("-auditTime", "-record"));
    return audits.map(audit => {
      const currentIndex = chronological.findIndex(item => item.id === audit.id);
      const previousAudit = chronological[currentIndex + 1];
      const thisTime = audit.auditTime;
      const prevTime = previousAudit?.auditTime;
      const durationMs = (prevTime && thisTime) ? Math.max(0, thisTime - prevTime) : 0;
      return {...audit, durationMs};
    });
  }

  private applyAudits(incoming: RamblersUploadAudit[]): void {
    const seen = new Set<string>();
    this.audits = incoming
      .filter(audit => {
        const key = audit.id || `${audit.fileName}-${audit.record}`;
        if (seen.has(key)) {
          return false;
        } else {
          seen.add(key);
          return true;
        }
      })
      .sort(sortBy("-auditTime", "-record"));
    this.audits = this.withDurations(this.audits);
    this.latestAudit = this.audits[0] || null;
    this.reportAudit = this.audits.find(audit => !!audit.reportKeyPrefix) || this.reportAudit;
    this.changeDetector.detectChanges();
  }
}
