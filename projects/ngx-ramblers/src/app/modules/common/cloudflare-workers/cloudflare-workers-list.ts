import { Component, EventEmitter, inject, Input, OnDestroy, OnInit, Output } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faCheck, faExternalLinkAlt, faTimes, faTrash } from "@fortawesome/free-solid-svg-icons";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import { Subscription } from "rxjs";
import { values } from "es-toolkit/compat";
import { CloudflareWorkerSortField, CloudflareWorkerRow, WorkerEmailUsageStatus } from "../../../models/cloudflare-email-routing.model";
import { StoredValue } from "../../../models/ui-actions";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { CloudflareUrlService } from "../../../services/cloudflare/cloudflare-url.service";
import { SortableTableComponent } from "../sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../sortable-table/sortable-table.model";

@Component({
  selector: "app-cloudflare-workers-list",
  imports: [SortableTableComponent, SortableTableCellDirective, FontAwesomeModule, TooltipDirective],
  template: `
    <app-sortable-table [columns]="columns" [rows]="rows" [defaultSortKey]="sortKey"
      [defaultSortDirection]="sortDirection" [emptyMessage]="emptyMessage" [trackBy]="trackWorker"
      (sortChange)="sortChanged($event)">
      <ng-template appSortableTableCell="actions" let-row>
        <div class="d-flex gap-2">
          @if (accountId) {
            <a class="btn btn-icon btn-quiet" [href]="cloudflareUrl.worker(accountId, row.id)"
              target="_blank" rel="noopener noreferrer" tooltip="Open in Cloudflare" aria-label="Open in Cloudflare">
              <fa-icon [icon]="faExternalLinkAlt"/>
            </a>
          }
          @if (canDelete(row)) {
            @if (deleteConfirmPending === row.id) {
              <button type="button" class="btn btn-icon btn-danger" tooltip="Confirm delete" aria-label="Confirm delete"
                (click)="deleteWorker.emit(row.id)"><fa-icon [icon]="faCheck"/></button>
              <button type="button" class="btn btn-icon btn-quiet" tooltip="Cancel" aria-label="Cancel"
                (click)="cancelDelete.emit()"><fa-icon [icon]="faTimes"/></button>
            } @else {
              <button type="button" class="btn btn-icon btn-danger" tooltip="Delete worker" aria-label="Delete worker"
                [disabled]="deletePending === row.id" (click)="requestDelete.emit(row.id)"><fa-icon [icon]="faTrash"/></button>
            }
          }
        </div>
      </ng-template>
    </app-sortable-table>
  `
})
export class CloudflareWorkersList implements OnInit, OnDestroy {
  @Input() rows: CloudflareWorkerRow[] = [];
  @Input() accountId: string = null;
  @Input() inventory = false;
  @Input() allowDelete = false;
  @Input() deleteConfirmPending: string = null;
  @Input() deletePending: string = null;
  @Input() emptyMessage = "No Cloudflare workers found";
  @Output() requestDelete = new EventEmitter<string>();
  @Output() cancelDelete = new EventEmitter<void>();
  @Output() deleteWorker = new EventEmitter<string>();
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private subscriptions: Subscription[] = [];
  cloudflareUrl = inject(CloudflareUrlService);
  sortKey = CloudflareWorkerSortField.SCRIPT;
  sortDirection = ASCENDING;
  protected readonly faCheck = faCheck;
  protected readonly faTimes = faTimes;
  protected readonly faTrash = faTrash;
  protected readonly faExternalLinkAlt = faExternalLinkAlt;
  readonly trackWorker = (_index: number, row: CloudflareWorkerRow) => row.id;

  get columns(): SortableTableColumn<CloudflareWorkerRow>[] {
    return [
      {key: "id", label: "Script", sortKey: CloudflareWorkerSortField.SCRIPT, cellGetter: row => row.id},
      ...(this.inventory ? [{key: "status", label: "Referenced By", sortKey: CloudflareWorkerSortField.STATUS, cellGetter: (row: CloudflareWorkerRow) => row.status}] : []),
      {key: "mapped", label: this.inventory ? "References across zones" : "Mapped", sortKey: CloudflareWorkerSortField.MAPPING, cellGetter: row => row.mapped},
      {key: "actions", label: ""}
    ];
  }

  ngOnInit(): void {
    this.subscriptions.push(this.route.queryParamMap.subscribe(params => {
      const key = params.get(StoredValue.CLOUDFLARE_WORKER_SORT) as CloudflareWorkerSortField;
      this.sortKey = this.columns.some(column => column.sortKey === key) ? key : CloudflareWorkerSortField.SCRIPT;
      this.sortDirection = params.get(StoredValue.CLOUDFLARE_WORKER_SORT_ORDER) === DESCENDING ? DESCENDING : ASCENDING;
    }));
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(subscription => subscription.unsubscribe());
  }

  canDelete(row: CloudflareWorkerRow): boolean {
    if (!this.allowDelete) {
      return false;
    } else if (this.inventory) {
      return row.status === WorkerEmailUsageStatus.UNREFERENCED;
    } else {
      return true;
    }
  }

  sortChanged(state: SortableTableSortState): void {
    this.sortKey = values(CloudflareWorkerSortField).includes(state.key as CloudflareWorkerSortField) ? state.key as CloudflareWorkerSortField : CloudflareWorkerSortField.SCRIPT;
    this.sortDirection = state.direction === DESCENDING ? DESCENDING : ASCENDING;
    this.router.navigate([], {relativeTo: this.route, queryParams: {
      [StoredValue.CLOUDFLARE_WORKER_SORT]: this.sortKey,
      [StoredValue.CLOUDFLARE_WORKER_SORT_ORDER]: this.sortDirection
    }, queryParamsHandling: "merge"});
  }
}
