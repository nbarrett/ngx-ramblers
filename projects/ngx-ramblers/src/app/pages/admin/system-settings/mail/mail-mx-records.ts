import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { coerceBooleanProperty } from "@angular/cdk/coercion";
import { ActivatedRoute, Router } from "@angular/router";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { TooltipDirective } from "ngx-bootstrap/tooltip";
import {
  faCheck,
  faCircleCheck,
  faCircleExclamation,
  faClose,
  faEnvelope,
  faPlus,
  faSpinner,
  faTrash,
  faRotate,
  faWrench,
  faTimes
} from "@fortawesome/free-solid-svg-icons";
import { MailDnsDelegationRemovalRequest, MailDnsLookupStatus, MailMxTableRow, MxExistingRecord, MxRecordStatus } from "../../../../models/cloudflare-email-routing.model";
import { StringUtilsService } from "../../../../services/string-utils.service";
import { SortableTableComponent } from "../../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableAlignment, SortableTableColumn, SortableTableSortState } from "../../../../modules/common/sortable-table/sortable-table.model";
import { SortDirection } from "../../../../models/sort.model";
import { ASCENDING, DESCENDING } from "../../../../models/table-filtering.model";
import { DisplayDateAndTimePipe } from "../../../../pipes/display-date-and-time.pipe";
import { StoredValue } from "../../../../models/ui-actions";

@Component({
  selector: "app-mail-mx-records",
  imports: [DisplayDateAndTimePipe, FontAwesomeModule, TooltipDirective, SortableTableComponent, SortableTableCellDirective],
  styles: [`
    :host
      display: block

    :host ::ng-deep .sortable-table-card
      overflow-x: auto

    :host ::ng-deep .sortable-table td
      word-break: normal
      overflow-wrap: break-word
  `],
  template: `
    <div class="mb-3">
      <div class="d-flex align-items-center gap-3 p-2 border rounded bg-light mb-2">
        <fa-icon [icon]="faEnvelope" class="fa-icon"></fa-icon>
        <div class="flex-grow-1">
          <strong>MX Records:</strong> {{ domain }}
          @if (loading) {
            <fa-icon [icon]="faSpinner" animation="spin" class="ms-2"></fa-icon>
          } @else if (status) {
            @if (status.allPresent) {
              <span class="badge bg-success ms-2">Cloudflare MX records present</span>
            } @else {
              <span class="badge bg-danger ms-2">Missing MX records</span>
            }
            @if (status.extraRecords?.length) {
              <span class="badge bg-warning text-dark ms-2">{{ stringUtils.pluraliseWithCount(status.extraRecords.length, "conflicting record") }}</span>
            }
          }
        </div>
        @if (allowMutate && status && !status.allPresent) {
          <button class="btn btn-primary text-nowrap flex-shrink-0" [disabled]="creating" (click)="addMissing.emit()">
            @if (creating) {
              <fa-icon [icon]="faSpinner" animation="spin" class="me-1"></fa-icon>Creating...
            } @else {
              <fa-icon [icon]="faPlus" class="me-1"></fa-icon>Add Missing MX Records
            }
          </button>
        }
      </div>
      @if (status?.dnsHealth; as health) {
        <div class="alert d-flex align-items-start" [class.alert-success]="health.healthy" [class.alert-warning]="!health.healthy">
          <fa-icon [icon]="health.healthy ? faCircleCheck : faCircleExclamation" class="me-2 mt-1"/>
          <div>
            <strong class="d-block">{{ health.healthy ? "Public mail DNS checks passed" : "Incoming mail DNS needs attention" }}</strong>
            <div>{{ health.message }}</div>
            @if (!health.healthy && domainSettingsUrl) {
              <a [href]="domainSettingsUrl" target="_blank" rel="noopener" class="d-inline-block mt-2">Admin → Mail Settings → Domains</a>
            }
            <div class="small mt-1">Checked {{ health.checkedAt | displayDateAndTime }}</div>
            @for (delegation of health.delegations; track delegation.hostname) {
              <div class="mt-2">NS records on <code>{{ delegation.hostname }}</code>:
                @for (record of delegation.records; track record.id) {
                  <code class="me-2">{{ record.content }}</code>
                }</div>
            }
            @for (lookup of health.lookups; track lookup.resolver) {
              <div class="mt-2">
                <strong>{{ lookup.resolver }}:</strong>
                @if (lookup.status === MailDnsLookupStatus.FAILED) {
                  Lookup failed ({{ lookup.error }}).
                } @else {
                  {{ lookup.status === MailDnsLookupStatus.MATCHED ? "Matches configured MX" : "Does not match configured MX" }}:
                  {{ lookup.exchanges.join(", ") || "No mail servers returned" }}.
                }
              </div>
            }
          </div>
        </div>
      }
      @if (allowMutate && allowMaintenance && delegationCanBeRemoved()) {
        <div class="thumbnail-heading-frame thumbnail-heading-frame-compact mb-3">
          <div class="thumbnail-heading">Mail DNS maintenance</div>
          <p>Brevo-managed setup can create NS delegation automatically. For an NGX website and inbox, keep DNS in Cloudflare. First use Authenticate Domain above to configure Brevo’s individual DKIM records; then review the delegation removal. NGX checks those signing records before allowing removal.</p>
          @if (!pendingDelegationRemoval) {
            <button class="btn btn-primary" type="button" [disabled]="maintenanceBusy || loading" (click)="reviewDelegationRemoval()">
              <fa-icon [icon]="faWrench" class="me-1"/>Review delegation removal
            </button>
          } @else {
            <div class="alert alert-warning d-flex align-items-start">
              <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"/>
              <div>
                <strong class="d-block">Confirm removal of NS delegation</strong>
                <p>This changes DNS authority for the whole subdomain, including its website and mail. Confirm that Cloudflare is the intended DNS host. These exact records will be removed:</p>
                <ul>
                  @for (record of pendingDelegationRemoval.records; track record.id) {
                    <li>NS <code>{{ record.name }}</code> → <code>{{ record.content }}</code></li>
                  }
                </ul>
                <p>MX, SPF, DKIM and DMARC records will be kept. Cached delegation may remain until its TTL expires.</p>
                <button class="btn btn-danger me-2" type="button" [disabled]="maintenanceBusy || loading" (click)="confirmDelegationRemoval()">
                  <fa-icon [icon]="maintenanceBusy ? faSpinner : faTrash" [animation]="maintenanceBusy ? 'spin' : null" class="me-1"/>Confirm removal
                </button>
                <button class="btn btn-quiet" type="button" [disabled]="maintenanceBusy" (click)="pendingDelegationRemoval = null">
                  <fa-icon [icon]="faTimes" class="me-1"/>Cancel
                </button>
              </div>
            </div>
          }
        </div>
      }
      @if (allowMutate) {
        <button class="btn btn-quiet mb-3" type="button" [disabled]="maintenanceBusy || loading" (click)="recheck.emit()">
          <fa-icon [icon]="faRotate" class="me-1"/>Re-check mail DNS
        </button>
      }
      @if (maintenanceMessage) {
        <div class="alert alert-success d-flex align-items-start">
          <fa-icon [icon]="faCircleCheck" class="me-2 mt-1"/>
          <div><strong class="d-block">DNS maintenance completed</strong>{{ maintenanceMessage }}</div>
        </div>
      }
      @if (status) {
        <app-sortable-table
          [columns]="columns()"
          [rows]="rows()"
          [defaultSortKey]="sortKey"
          [defaultSortDirection]="sortDirection"
          [trackBy]="trackRow"
          (sortChange)="onSortChange($event)"
          emptyMessage="No MX records found.">
          <ng-template appSortableTableCell="server" let-row>
            {{ row.content }}
          </ng-template>
          <ng-template appSortableTableCell="priority" let-row>
            {{ row.priority ?? "" }}
          </ng-template>
          <ng-template appSortableTableCell="status" let-row>
            @if (row.extra) {
              <span class="badge bg-warning text-dark">Conflicting</span>
            } @else if (row.present) {
              <fa-icon [icon]="faCheck" class="text-success"></fa-icon>
            } @else {
              <fa-icon [icon]="faClose" class="text-danger"></fa-icon>
            }
          </ng-template>
          <ng-template appSortableTableCell="action" let-row>
            @if (row.extra && row.id) {
              <button class="btn btn-danger btn-icon"
                      tooltip="Delete MX record"
                      container="body"
                      [disabled]="deletingId === row.id"
                      (click)="deleteExtra.emit(asExisting(row))"
                      aria-label="Delete MX record">
                @if (deletingId === row.id) {
                  <fa-icon [icon]="faSpinner" animation="spin"></fa-icon>
                } @else {
                  <fa-icon [icon]="faTrash"></fa-icon>
                }
              </button>
            }
          </ng-template>
        </app-sortable-table>
        @if (status.extraRecords?.length) {
          <div class="small text-muted mt-2">
            Conflicting records are present on {{ domain }} but are not part of Cloudflare email routing. They will conflict with inbound delivery and should be removed unless intentional.
          </div>
        }
      }
      @if (error) {
        <div class="alert alert-danger mt-2 mb-0">
          <div class="d-flex align-items-start">
            <fa-icon [icon]="faCircleExclamation" class="me-2 mt-1"></fa-icon>
            <div><strong class="d-block">Mail DNS needs attention</strong>{{ error }}</div>
          </div>
        </div>
      }
    </div>
  `
})
export class MailMxRecords {
  private activatedRoute = inject(ActivatedRoute);
  private router = inject(Router);
  protected stringUtils = inject(StringUtilsService);

  @Input() domain = "";
  @Input() domainSettingsUrl: string | null = null;
  @Input() status: MxRecordStatus | null = null;
  @Input() loading = false;
  @Input() creating = false;
  @Input() deletingId: string | null = null;
  @Input() error: string | null = null;
  @Input() maintenanceBusy = false;
  @Input() maintenanceMessage: string | null = null;
  @Output() removeDelegation = new EventEmitter<MailDnsDelegationRemovalRequest>();
  @Output() recheck = new EventEmitter<void>();
  protected pendingDelegationRemoval: MailDnsDelegationRemovalRequest | null = null;
  @Output() addMissing = new EventEmitter<void>();
  @Output() deleteExtra = new EventEmitter<MxExistingRecord>();

  private allowMutateValue = false;
  private allowMaintenanceValue = false;
  sortKey = "content";
  sortDirection = ASCENDING;
  protected readonly faCheck = faCheck;
  protected readonly faCircleCheck = faCircleCheck;
  protected readonly faCircleExclamation = faCircleExclamation;
  protected readonly MailDnsLookupStatus = MailDnsLookupStatus;
  protected readonly faClose = faClose;
  protected readonly faEnvelope = faEnvelope;
  protected readonly faPlus = faPlus;
  protected readonly faSpinner = faSpinner;
  protected readonly faTrash = faTrash;
  protected readonly faWrench = faWrench;
  protected readonly faRotate = faRotate;
  protected readonly faTimes = faTimes;

  constructor() {
    const params = this.activatedRoute.snapshot.queryParams;
    this.sortKey = params[StoredValue.MAIL_MX_SORT] || "content";
    this.sortDirection = params[StoredValue.MAIL_MX_SORT_ORDER] === SortDirection.DESC ? DESCENDING : ASCENDING;
  }

  @Input() set allowMutate(value: boolean) {
    this.allowMutateValue = coerceBooleanProperty(value);
  }

  get allowMutate(): boolean {
    return this.allowMutateValue;
  }

  @Input() set allowMaintenance(value: boolean) {
    this.allowMaintenanceValue = coerceBooleanProperty(value);
  }

  get allowMaintenance(): boolean {
    return this.allowMaintenanceValue;
  }

  delegationRecords(): MxExistingRecord[] {
    return (this.status?.dnsHealth?.delegations || []).flatMap(delegation => delegation.records);
  }

  delegationCanBeRemoved(): boolean {
    const records = this.delegationRecords();
    return !!this.status?.allPresent && !this.status?.extraRecords?.length && records.length > 0
      && records.every(record => record.name === this.status.subdomain);
  }

  reviewDelegationRemoval(): void {
    this.pendingDelegationRemoval = {hostname: this.status.subdomain, records: this.delegationRecords().map(record => ({...record}))};
  }

  confirmDelegationRemoval(): void {
    if (this.allowMutate && this.allowMaintenance && this.pendingDelegationRemoval && this.delegationCanBeRemoved() && !this.maintenanceBusy && !this.loading) {
      this.removeDelegation.emit(this.pendingDelegationRemoval);
      this.pendingDelegationRemoval = null;
    }
  }

  columns(): SortableTableColumn<MailMxTableRow>[] {
    const base: SortableTableColumn<MailMxTableRow>[] = [
      {key: "server", label: "MX Server", sortKey: "content"},
      {key: "priority", label: "Priority", sortKey: "priority", align: SortableTableAlignment.CENTER},
      {key: "status", label: "Status", sortKey: "present", align: SortableTableAlignment.CENTER}
    ];
    if (this.allowMutateValue) {
      return base.concat([{key: "action", label: "Action", align: SortableTableAlignment.CENTER}]);
    } else {
      return base;
    }
  }

  rows(): MailMxTableRow[] {
    if (!this.status) {
      return [];
    } else {
      const expected = (this.status.expectedRecords || []).map(record => ({
        content: record.content,
        priority: record.priority,
        present: record.exists,
        extra: false,
        id: null
      }));
      const extra = (this.status.extraRecords || []).map(record => ({
        content: record.content,
        priority: record.priority ?? null,
        present: true,
        extra: true,
        id: record.id || null
      }));
      return expected.concat(extra);
    }
  }

  trackRow(_index: number, row: MailMxTableRow): string {
    return `${row.extra ? "extra" : "expected"}:${row.id || row.content}`;
  }

  asExisting(row: MailMxTableRow): MxExistingRecord {
    return {
      id: row.id || "",
      name: this.domain,
      type: "MX",
      content: row.content,
      priority: row.priority ?? undefined
    };
  }

  onSortChange(sortState: SortableTableSortState): void {
    this.sortKey = sortState.key || "content";
    this.sortDirection = sortState.direction;
    this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: {
        [StoredValue.MAIL_MX_SORT]: this.sortKey,
        [StoredValue.MAIL_MX_SORT_ORDER]: this.sortDirection === DESCENDING ? SortDirection.DESC : SortDirection.ASC
      },
      queryParamsHandling: "merge"
    });
  }
}
