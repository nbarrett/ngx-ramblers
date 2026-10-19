import { ChangeDetectorRef, Component, EventEmitter, inject, Input, OnChanges, OnDestroy, OnInit, Output } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faTrash } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { Subscription } from "rxjs";
import { memberBulkLoadSessionMemberCount } from "../../../functions/member-bulk-load-rows";
import { MemberBulkLoadAudit, MemberBulkLoadSessionRow } from "../../../models/member.model";
import { memberBulkLoadSourceLabel } from "../../../models/salesforce.model";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { StoredValue } from "../../../models/ui-actions";
import { DisplayDateAndTimePipe } from "../../../pipes/display-date-and-time.pipe";
import { UiActionsService } from "../../../services/ui-actions.service";
import { SortableTableComponent } from "../sortable-table/sortable-table.component";
import { SortableTableCellDirective, SortableTableHeaderCellDirective } from "../sortable-table/sortable-table-cell.directive";
import { SortableTableAlignment, SortableTableColumn, SortableTableSortState } from "../sortable-table/sortable-table.model";

@Component({
  selector: "app-member-bulk-load-sessions",
  imports: [SortableTableComponent, SortableTableCellDirective, SortableTableHeaderCellDirective, DisplayDateAndTimePipe, FontAwesomeModule, TooltipDirective],
  template: `
    <app-sortable-table [columns]="columns" [rows]="rows" [defaultSortKey]="sortKey" [defaultSortDirection]="sortDirection"
                        [trackBy]="trackSession" (sortChange)="onSort($event)"
                        emptyMessage="No upload sessions match this view.">
      <ng-template appSortableTableHeaderCell="selection">
        <input type="checkbox" class="form-check-input" [checked]="allSelected" [disabled]="disabled || !rows.length"
               [indeterminate]="someSelected && !allSelected" (change)="toggleAll($event)" aria-label="Select all sessions in range">
      </ng-template>
      <ng-template appSortableTableCell="selection" let-session>
        <input type="checkbox" class="form-check-input" [checked]="selectedSessionIds.includes(session.id)"
               [disabled]="disabled || !session.id" (change)="toggleSession(session, $event)"
               [attr.aria-label]="'Select session from ' + (session.createdDate | displayDateAndTime)">
      </ng-template>
      <ng-template appSortableTableCell="createdDate" let-session>
        {{ session.createdDate | displayDateAndTime }}
      </ng-template>
      <ng-template appSortableTableCell="actions" let-session>
        <button type="button" class="btn btn-quiet btn-icon" [disabled]="disabled" (click)="deleteSession.emit(session)"
                tooltip="Delete session" aria-label="Delete session"><fa-icon [icon]="faTrash"/></button>
      </ng-template>
    </app-sortable-table>
  `
})
export class MemberBulkLoadSessionsComponent implements OnInit, OnChanges, OnDestroy {
  private route = inject(ActivatedRoute);
  private changeDetector = inject(ChangeDetectorRef);
  private uiActions = inject(UiActionsService);
  private subscriptions: Subscription[] = [];
  @Input() set sessions(value: MemberBulkLoadAudit[]) {
    this.rows = (value || []).map(session => ({...session, memberCount: memberBulkLoadSessionMemberCount(session), sourceLabel: memberBulkLoadSourceLabel(session.source)}));
  }
  @Input() selectable = false;
  @Input() selectedSessionIds: string[] = [];
  @Input() disabled = false;
  @Output() selectedSessionIdsChange = new EventEmitter<string[]>();
  @Output() deleteSession = new EventEmitter<MemberBulkLoadAudit>();
  protected rows: MemberBulkLoadSessionRow[] = [];
  protected sortKey = "createdDate";
  protected sortDirection = DESCENDING;
  protected readonly faTrash = faTrash;
  private readonly dataColumns: SortableTableColumn<MemberBulkLoadSessionRow>[] = [
    {key: "createdDate", label: "Uploaded at", sortKey: "createdDate"},
    {key: "sourceLabel", label: "Source", sortKey: "sourceLabel", cellGetter: row => row.sourceLabel},
    {key: "memberCount", label: "Members in session", sortKey: "memberCount", cellGetter: row => row.memberCount}
  ];

  protected columns: SortableTableColumn<MemberBulkLoadSessionRow>[] = [];

  ngOnChanges(): void {
    this.configureColumns();
  }

  private configureColumns(): void {
    this.columns = [
      ...(this.selectable ? [{key: "selection", label: "", width: "2.5rem", align: SortableTableAlignment.CENTER}] : []),
      ...this.dataColumns,
      ...(this.deleteSession.observed ? [{key: "actions", label: "", align: SortableTableAlignment.RIGHT}] : [])
    ];
  }

  protected get allSelected(): boolean {
    return this.rows.length > 0 && this.rows.every(row => !!row.id && this.selectedSessionIds.includes(row.id));
  }

  protected get someSelected(): boolean {
    return this.rows.some(row => this.selectedSessionIds.includes(row.id));
  }

  ngOnInit(): void {
    this.configureColumns();
    this.subscriptions.push(this.route.queryParamMap.subscribe(params => {
      const key = params.get(StoredValue.UPLOAD_SESSION_SORT);
      this.sortKey = this.dataColumns.some(column => column.sortKey === key) ? key : "createdDate";
      this.sortDirection = params.get(StoredValue.UPLOAD_SESSION_SORT_ORDER) === ASCENDING ? ASCENDING : DESCENDING;
      this.changeDetector.markForCheck();
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  protected onSort(state: SortableTableSortState): void {
    this.sortKey = state.key || "createdDate";
    this.sortDirection = state.direction === ASCENDING ? ASCENDING : DESCENDING;
    void this.uiActions.updateQueryParameters({
      [StoredValue.UPLOAD_SESSION_SORT]: this.sortKey,
      [StoredValue.UPLOAD_SESSION_SORT_ORDER]: this.sortDirection
    });
  }

  protected toggleAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectedSessionIdsChange.emit(checked ? this.rows.map(row => row.id).filter(Boolean) : []);
  }

  protected toggleSession(session: MemberBulkLoadAudit, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const remaining = this.selectedSessionIds.filter(id => id !== session.id);
    this.selectedSessionIdsChange.emit(checked ? [...remaining, session.id] : remaining);
  }

  protected trackSession(_index: number, session: MemberBulkLoadAudit): string {
    return session.id;
  }
}
