import {Component, EventEmitter, inject, Input, OnInit, Output} from "@angular/core";
import {ActivatedRoute, Router} from "@angular/router";
import {FontAwesomeModule} from "@fortawesome/angular-fontawesome";
import {faCopy, faFolderOpen, faSpinner, faTrash, faTriangleExclamation} from "@fortawesome/free-solid-svg-icons";
import {TooltipDirective} from "ngx-bootstrap/tooltip";
import {EmailCompositionStatus, EmailCompositionSummary} from "../../../models/email-composer.model";
import {Member} from "../../../models/member.model";
import {StoredValue} from "../../../models/ui-actions";
import {DESCENDING, ASCENDING} from "../../../models/table-filtering.model";
import {EmailCompositionsService} from "../../../services/email-composer/email-compositions.service";
import {MemberLoginService} from "../../../services/member/member-login.service";
import {DateUtilsService} from "../../../services/date-utils.service";
import {SortableTableComponent} from "../sortable-table/sortable-table.component";
import {SortableTableCellDirective, SortableTableHeaderCellDirective} from "../sortable-table/sortable-table-cell.directive";
import {SortableTableColumn, SortableTableSortState} from "../sortable-table/sortable-table.model";
import {AlertPanelComponent} from "../alert-panel/alert-panel";

@Component({
  selector: "app-email-composition-list",
  imports: [FontAwesomeModule, TooltipDirective, SortableTableComponent, SortableTableCellDirective, SortableTableHeaderCellDirective, AlertPanelComponent],
  template: `
    @if (selectedIds.size > 0) {
      <div class="d-flex align-items-center gap-2 mb-2">
        <button type="button" class="btn btn-danger" [disabled]="busy || deleting" (click)="confirming = true">
          <fa-icon [icon]="faTrash" class="me-1"/>Delete {{ selectedIds.size }} selected
        </button>
      </div>
    }
    @if (confirming) {
      <app-alert-panel title="Delete saved emails?" [icon]="faTriangleExclamation" class="d-block mb-2">
        Deleted emails cannot be recovered. Shared drafts disappear for everyone.
        <div alertActions class="d-flex gap-2">
          <button type="button" class="btn btn-danger" [disabled]="deleting" (click)="deleteSelected()">
            @if (deleting) { <fa-icon [icon]="faSpinner" animation="spin" class="me-1"/> }
            Confirm delete
          </button>
          <button type="button" class="btn btn-quiet" [disabled]="deleting" (click)="confirming = false">Cancel</button>
        </div>
      </app-alert-panel>
    }
    @if (errorMessage) {
      <app-alert-panel title="Could not delete saved emails" class="d-block mb-2">{{ errorMessage }}</app-alert-panel>
    }
    <app-sortable-table [flat]="embedded" [rows]="visibleRecords" [columns]="visibleColumns" [defaultSortKey]="sortKey"
                        [defaultSortDirection]="sortDirection" [trackBy]="trackRecord"
                        [emptyMessage]="searchTerm ? 'No saved emails match this search.' : 'No saved emails yet.'"
                        (sortChange)="onSortChange($event)" (rowSelect)="open.emit($event)">
      <ng-template appSortableTableHeaderCell="selection">
        <input type="checkbox" class="form-check-input" aria-label="Select all visible saved emails"
               [checked]="allSelected()" [indeterminate]="someSelected() && !allSelected()"
               [disabled]="busy || deleting" (click)="$event.stopPropagation()" (change)="toggleSelectAll()">
      </ng-template>
      <ng-template appSortableTableCell="selection" let-record>
        <input type="checkbox" class="form-check-input" aria-label="Select saved email"
               [checked]="selectedIds.has(record.id)" [disabled]="busy || deleting"
               (click)="$event.stopPropagation()" (change)="toggleSelection(record.id)">
      </ng-template>
      <ng-template appSortableTableCell="title" let-record>{{ record.title || '(untitled email)' }}</ng-template>
      <ng-template appSortableTableCell="owner" let-record>{{ ownerLabel(record) }}</ng-template>
      <ng-template appSortableTableCell="savedAt" let-record>{{ dateUtils.displayDateAndTime(record.sentAt || record.savedAt) }}</ng-template>
      <ng-template appSortableTableCell="shared" let-record>{{ record.shared ? 'Shared with committee' : 'Private' }}</ng-template>
      <ng-template appSortableTableCell="actions" let-record>
        <div class="d-flex flex-nowrap gap-2">
          <button type="button" class="btn btn-primary btn-icon" [disabled]="busy || deleting"
                  [tooltip]="record.status === EmailCompositionStatus.Sent ? 'Use as template' : 'Load draft'" container="body"
                  [attr.aria-label]="record.status === EmailCompositionStatus.Sent ? 'Use as template' : 'Load draft'"
                  (click)="$event.stopPropagation(); open.emit(record)">
            <fa-icon [icon]="record.status === EmailCompositionStatus.Sent ? faCopy : faFolderOpen"/>
          </button>
          <button type="button" class="btn btn-danger btn-icon" tooltip="Delete saved email" container="body"
                  [disabled]="busy || deleting" (click)="$event.stopPropagation(); requestDelete(record.id)">
            <fa-icon [icon]="faTrash"/>
          </button>
        </div>
      </ng-template>
    </app-sortable-table>
  `
})
export class EmailCompositionListComponent implements OnInit {
  @Input() records: EmailCompositionSummary[] = [];
  @Input() members: Member[] = [];
  @Input() searchTerm = "";
  @Input() busy = false;
  @Input() showActions = true;
  @Input() embedded = false;
  @Output() open = new EventEmitter<EmailCompositionSummary>();
  @Output() deleted = new EventEmitter<string[]>();
  protected dateUtils = inject(DateUtilsService);
  private compositions = inject(EmailCompositionsService);
  private memberLogin = inject(MemberLoginService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  protected selectedIds = new Set<string>();
  protected confirming = false;
  protected deleting = false;
  protected errorMessage: string | null = null;
  protected sortKey = "savedAt";
  protected sortDirection = DESCENDING;
  protected readonly EmailCompositionStatus = EmailCompositionStatus;
  protected readonly faCopy = faCopy;
  protected readonly faFolderOpen = faFolderOpen;
  protected readonly faTrash = faTrash;
  protected readonly faSpinner = faSpinner;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly trackRecord = (_index: number, record: EmailCompositionSummary) => record.id;
  protected readonly columns: SortableTableColumn<EmailCompositionSummary>[] = [
    {key: "selection", label: ""},
    {key: "title", label: "Subject", sortKey: "title"},
    {key: "owner", label: "Owner", sortKey: "ownerMemberId"},
    {key: "savedAt", label: "Date", sortKey: "savedAt"},
    {key: "shared", label: "Visibility", sortKey: "shared"},
    {key: "actions", label: "Actions"}
  ];

  protected get visibleColumns(): SortableTableColumn<EmailCompositionSummary>[] {
    return this.showActions ? this.columns : this.columns.filter(column => column.key !== "actions");
  }

  ngOnInit(): void {
    const key = this.route.snapshot.queryParamMap.get(StoredValue.COMPOSITION_SORT);
    const direction = this.route.snapshot.queryParamMap.get(StoredValue.COMPOSITION_SORT_ORDER);
    if (key && this.visibleColumns.some(column => column.sortKey === key)) {
      this.sortKey = key;
    }
    this.sortDirection = direction === ASCENDING ? ASCENDING : DESCENDING;
  }

  protected get visibleRecords(): EmailCompositionSummary[] {
    const term = this.searchTerm.trim().toLowerCase();
    return term ? this.records.filter(record => (record.title ?? "").toLowerCase().includes(term)) : this.records;
  }

  protected onSortChange(state: SortableTableSortState): void {
    this.sortKey = state.key ?? "savedAt";
    this.sortDirection = state.direction;
    void this.router.navigate([], {queryParams: {[StoredValue.COMPOSITION_SORT]: this.sortKey, [StoredValue.COMPOSITION_SORT_ORDER]: state.direction}, queryParamsHandling: "merge", replaceUrl: true});
  }

  protected ownerLabel(record: EmailCompositionSummary): string {
    const owner = this.members.find(member => member.id === record.ownerMemberId);
    const name = owner ? `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() : "";
    return name || (record.ownerMemberId === this.memberLogin.loggedInMember()?.memberId ? "You" : "Committee member");
  }

  protected toggleSelection(id: string): void {
    const next = new Set(this.selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedIds = next;
    this.confirming = this.confirming && next.size > 0;
  }

  protected allSelected(): boolean {
    return this.visibleRecords.length > 0 && this.visibleRecords.every(record => this.selectedIds.has(record.id));
  }

  protected someSelected(): boolean {
    return this.visibleRecords.some(record => this.selectedIds.has(record.id));
  }

  protected toggleSelectAll(): void {
    const next = new Set(this.selectedIds);
    if (this.allSelected()) {
      this.visibleRecords.forEach(record => next.delete(record.id));
      this.confirming = false;
    } else {
      this.visibleRecords.forEach(record => next.add(record.id));
    }
    this.selectedIds = next;
  }

  protected requestDelete(id: string): void {
    this.selectedIds = new Set([id]);
    this.confirming = true;
  }

  protected async deleteSelected(): Promise<void> {
    if (!this.deleting && !this.busy && this.confirming && this.selectedIds.size > 0) {
      this.deleting = true;
      this.errorMessage = null;
      const ids = [...this.selectedIds];
      try {
        const results = await Promise.allSettled(ids.map(id => this.compositions.remove(id)));
        const removed = ids.filter((_id, index) => results[index].status === "fulfilled");
        const failed = results.find(result => result.status === "rejected");
        this.selectedIds = new Set(ids.filter(id => !removed.includes(id)));
        this.confirming = this.selectedIds.size > 0;
        this.errorMessage = failed?.status === "rejected" ? (failed.reason as Error).message : null;
        this.deleted.emit(removed);
      } finally {
        this.deleting = false;
      }
    }
  }
}
