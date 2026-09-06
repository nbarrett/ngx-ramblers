import { Component, inject, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCircleExclamation, faRotate } from "@fortawesome/free-solid-svg-icons";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { NgxLoggerLevel } from "ngx-logger";
import { Subscription } from "rxjs";
import { DisplayDateAndTimePipe } from "../../../../pipes/display-date-and-time.pipe";
import { SortableTableComponent } from "../../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../../../modules/common/sortable-table/sortable-table.model";
import { MailSendRefusal, MailSendRefusalColumn, SEND_PURPOSE_DESCRIPTIONS, SendStatus } from "../../../../models/mail.model";
import { StoredValue } from "../../../../models/ui-actions";
import { ASCENDING, DESCENDING } from "../../../../models/table-filtering.model";
import { SortDirection } from "../../../../models/sort.model";
import { Logger, LoggerFactory } from "../../../../services/logger-factory.service";
import { MailService } from "../../../../services/mail/mail.service";

@Component({
  selector: "app-mail-send-refusals",
  imports: [FontAwesomeModule, TooltipModule, SortableTableComponent, SortableTableCellDirective, DisplayDateAndTimePipe],
  template: `
    @if (sendStatus?.platformControl?.sendingSuspended) {
      <div class="alert alert-warning d-flex align-items-start">
        <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
        <div>
          <strong>Email sending is suspended by the platform administrator</strong>
          <div>{{ sendStatus.transactional.message }} This overrides the settings above and cannot be changed from this site.</div>
        </div>
      </div>
    }
    <div class="d-flex align-items-center justify-content-between mb-2">
      <div class="thumbnail-heading mb-0">Refused sends</div>
      <button type="button" class="btn btn-quiet btn-icon" tooltip="Refresh refused sends" (click)="refresh()" [disabled]="loading">
        <fa-icon [icon]="faRotate" [animation]="loading ? 'spin' : undefined"/>
      </button>
    </div>
    <div class="form-text mb-2">Every email refused because sending was switched off here, or suspended by the platform administrator, is listed with the reason. Most recent first.</div>
    <app-sortable-table
      [columns]="columns"
      [rows]="refusals"
      [defaultSortKey]="sortKey"
      [defaultSortDirection]="sortDirection"
      [maxHeight]="'24rem'"
      emptyMessage="No sends have been refused."
      (sortChange)="onSortChange($event)">
      <ng-template [appSortableTableCell]="MailSendRefusalColumn.REFUSED_AT" let-row>
        <span class="text-nowrap">{{ row.refusedAt | displayDateAndTime }}</span>
      </ng-template>
      <ng-template [appSortableTableCell]="MailSendRefusalColumn.PURPOSE" let-row>{{ purposeDescription(row) }}</ng-template>
      <ng-template [appSortableTableCell]="MailSendRefusalColumn.SUBJECT" let-row>{{ row.subject || "—" }}</ng-template>
      <ng-template [appSortableTableCell]="MailSendRefusalColumn.RECIPIENT_COUNT" let-row>{{ row.recipientCount ?? "—" }}</ng-template>
      <ng-template [appSortableTableCell]="MailSendRefusalColumn.MESSAGE" let-row>{{ row.message }}</ng-template>
    </app-sortable-table>
  `
})
export class MailSendRefusalsComponent implements OnInit, OnDestroy {
  private logger: Logger = inject(LoggerFactory).createLogger("MailSendRefusalsComponent", NgxLoggerLevel.ERROR);
  private mailService = inject(MailService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private subscriptions: Subscription[] = [];
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly faRotate = faRotate;
  protected readonly MailSendRefusalColumn = MailSendRefusalColumn;
  protected refusals: MailSendRefusal[] = [];
  protected sendStatus: SendStatus | null = null;
  protected loading = false;
  protected sortKey: string = MailSendRefusalColumn.REFUSED_AT;
  protected sortDirection: string = DESCENDING;
  protected readonly columns: SortableTableColumn<MailSendRefusal>[] = [
    {key: MailSendRefusalColumn.REFUSED_AT, label: "When", sortKey: MailSendRefusalColumn.REFUSED_AT},
    {key: MailSendRefusalColumn.PURPOSE, label: "What", sortKey: MailSendRefusalColumn.PURPOSE},
    {key: MailSendRefusalColumn.SUBJECT, label: "Subject", sortKey: MailSendRefusalColumn.SUBJECT},
    {key: MailSendRefusalColumn.RECIPIENT_COUNT, label: "Recipients", sortKey: MailSendRefusalColumn.RECIPIENT_COUNT},
    {key: MailSendRefusalColumn.MESSAGE, label: "Reason", sortKey: MailSendRefusalColumn.MESSAGE}
  ];

  ngOnInit(): void {
    this.subscriptions.push(this.route.queryParams.subscribe(params => {
      const sortKey = params[StoredValue.AUDIT_SORT];
      const sortOrder = params[StoredValue.AUDIT_SORT_ORDER];
      this.sortKey = sortKey || MailSendRefusalColumn.REFUSED_AT;
      this.sortDirection = sortOrder === SortDirection.ASC ? ASCENDING : DESCENDING;
    }));
    void this.refresh();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  protected purposeDescription(row: MailSendRefusal): string {
    return SEND_PURPOSE_DESCRIPTIONS[row.purpose] || row.purpose;
  }

  protected onSortChange(state: SortableTableSortState): void {
    const key = state.key || MailSendRefusalColumn.REFUSED_AT;
    const direction = state.direction === ASCENDING ? ASCENDING : DESCENDING;
    const isDefault = key === MailSendRefusalColumn.REFUSED_AT && direction === DESCENDING;
    this.router.navigate([], {
      queryParams: {
        [StoredValue.AUDIT_SORT]: isDefault ? null : key,
        [StoredValue.AUDIT_SORT_ORDER]: isDefault ? null : (direction === ASCENDING ? SortDirection.ASC : SortDirection.DESC)
      },
      queryParamsHandling: "merge"
    });
  }

  async refresh(): Promise<void> {
    this.loading = true;
    try {
      const [refusals, sendStatus] = await Promise.all([this.mailService.sendRefusals(), this.mailService.sendStatus()]);
      this.refusals = refusals;
      this.sendStatus = sendStatus;
    } catch (error) {
      this.logger.error("failed to load send refusals:", error);
    } finally {
      this.loading = false;
    }
  }
}
