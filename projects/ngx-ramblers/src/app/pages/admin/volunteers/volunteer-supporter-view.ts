import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { FormsModule } from "@angular/forms";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronRight, faPenToSquare, faRightLeft, faTriangleExclamation } from "@fortawesome/free-solid-svg-icons";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import { Member } from "../../../models/member.model";
import {
  VolunteerAssignment,
  VolunteerAssignmentBulkAction,
  VolunteerAssignmentBulkRequest,
  VolunteerAssignmentPreviewLine,
  VolunteerAssignmentStatus,
  VolunteerSupporterAssignment,
  VolunteerSupporterRow,
  VolunteerSupporterSortField,
  VolunteerSupporterTableColumn
} from "../../../models/volunteer-management.model";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import {
  SortableTableCellDirective,
  SortableTableExpandedRowDirective
} from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { ASCENDING } from "../../../models/table-filtering.model";
import { DateUtilsService } from "../../../services/date-utils.service";
import { MemberSelector } from "../../../shared/components/member-selector";
import { memberFullName } from "../../../functions/member-names";

@Component({
  selector: "app-volunteer-supporter-view",
  imports: [FormsModule, FontAwesomeModule, TooltipModule, SortableTableComponent, SortableTableCellDirective, SortableTableExpandedRowDirective, MemberSelector],
  template: `
    @if (selectedAssignmentIds.length > 0) {
      <section class="replacement-panel" aria-labelledby="replacement-heading">
        <div class="replacement-heading">
          <div>
            <h2 id="replacement-heading">Selected assignments</h2>
            <p class="mb-0">{{ selectedAssignmentIds.length }} assignment{{ selectedAssignmentIds.length === 1 ? "" : "s" }} selected for {{ replacementSourceName }}.</p>
          </div>
          <button type="button" class="btn btn-quiet" (click)="cancelSelection()">Cancel</button>
        </div>
        @if (previewVisible) {
          <div class="replacement-preview">
            <p class="mb-2"><strong>Confirm these changes</strong></p>
            <ul>
              @for (line of previewLines; track line.assignmentId) {
                <li>{{ line.parishName }} — {{ line.roleLabel }}: <span class="from-name">{{ line.currentValue }}</span> → <strong>{{ line.newValue }}</strong></li>
              }
            </ul>
            <div class="replacement-actions">
              <button type="button" class="btn btn-primary" (click)="confirmBulkAction()" [disabled]="saving">{{ saving ? "Applying…" : "Confirm changes" }}</button>
              <button type="button" class="btn btn-quiet" (click)="previewVisible = false" [disabled]="saving">Back</button>
            </div>
          </div>
        } @else {
          <div class="replacement-form">
            <label>Action
              <select class="form-select" [(ngModel)]="bulkAction" [disabled]="saving">
                <option [ngValue]="VolunteerAssignmentBulkAction.REPLACE_SUPPORTER">Replace with another volunteer</option>
                <option [ngValue]="VolunteerAssignmentBulkAction.MARK_PERMANENT">Mark as permanent cover</option>
                <option [ngValue]="VolunteerAssignmentBulkAction.MARK_TEMPORARY">Mark as temporary cover</option>
                <option [ngValue]="VolunteerAssignmentBulkAction.END">End these assignments</option>
              </select>
            </label>
            @if (bulkAction === VolunteerAssignmentBulkAction.REPLACE_SUPPORTER) {
              <label>Replacement volunteer
                <app-member-selector [members]="members" placeholder="Search for a supporter" [(selectedMember)]="replacementSupporter" [disabled]="saving"/>
              </label>
            }
            <div class="replacement-actions">
              <button type="button" class="btn btn-primary" (click)="previewVisible = true" [disabled]="!bulkActionReady || saving">Preview changes</button>
            </div>
          </div>
        }
      </section>
    }

    <div class="d-none d-md-block table-fill">
      <app-sortable-table
        [columns]="columns"
        [rows]="rows"
        [defaultSortKey]="sortField"
        [defaultSortDirection]="sortDirection"
        [trackBy]="trackSupporter"
        [expandedWhen]="rowExpanded"
        [maxHeight]="'100%'"
        emptyMessage="No volunteers match the selected filters."
        (sortChange)="sortChange.emit($event)"
        (rowSelect)="toggleExpanded($event)">
        <ng-template [appSortableTableCell]="VolunteerSupporterTableColumn.DISPLAY_NAME" let-row>
          <div class="supporter-name">
            <fa-icon [icon]="expandedKey === row.key ? faChevronDown : faChevronRight" size="xs"/>
            <div>
              <strong>{{ row.displayName }}</strong>
              @if (row.email) {
                <div class="small text-muted">{{ row.email }}</div>
              }
              @if (!row.supporterId) {
                <div class="small unresolved"><fa-icon [icon]="faTriangleExclamation"/> Not linked to a supporter record</div>
              }
            </div>
          </div>
        </ng-template>
        <ng-template [appSortableTableCell]="VolunteerSupporterTableColumn.ROLES" let-row>{{ row.roles }}</ng-template>
        <ng-template [appSortableTableCell]="VolunteerSupporterTableColumn.PARISHES" let-row>
          <span [tooltip]="row.parishes">{{ row.parishCount }}</span>
        </ng-template>
        <ng-template [appSortableTableCell]="VolunteerSupporterTableColumn.ACTIVE_ASSIGNMENT_COUNT" let-row>
          {{ row.activeAssignmentCount }}
          @if (row.endedAssignmentCount > 0) {
            <div class="small text-muted">{{ row.endedAssignmentCount }} ended</div>
          }
        </ng-template>
        <ng-template [appSortableTableCell]="VolunteerSupporterTableColumn.COVER" let-row>{{ row.cover }}</ng-template>
        <ng-template [appSortableTableCell]="VolunteerSupporterTableColumn.STATUS" let-row>
          <span class="status-chip" [class.inactive]="row.activeAssignmentCount === 0">{{ row.statusLabel }}</span>
        </ng-template>
        <ng-template [appSortableTableCell]="VolunteerSupporterTableColumn.ACTIONS" let-row>
          <button type="button" class="btn btn-quiet btn-icon"
                  (click)="$event.stopPropagation(); beginReplacement(row)"
                  [attr.aria-label]="'Replace ' + row.displayName"
                  [tooltip]="'Select assignments to move from ' + row.displayName + ' to another volunteer'"><fa-icon [icon]="faRightLeft"/></button>
        </ng-template>
        <ng-template appSortableTableExpandedRow let-row>
          <div class="assignment-list">
            @for (entry of row.assignments; track entry.assignmentId) {
              <div class="assignment-entry" [class.ended]="ended(entry)">
                <label class="assignment-select" [tooltip]="ended(entry) ? 'Ended assignments cannot be reassigned' : 'Select for replacement'">
                  <input type="checkbox" [disabled]="ended(entry)" [checked]="assignmentSelected(entry)" (change)="toggleAssignment(row, entry)">
                </label>
                <div>
                  <button type="button" class="parish-link" (click)="parishSelect.emit(entry.parishName)"
                          [tooltip]="'Show ' + entry.parishName + ' in the parishes view'">{{ entry.parishName }}</button>
                  @if (entry.localAuthorityName) {
                    <div class="small text-muted">{{ entry.localAuthorityName }}</div>
                  }
                </div>
                <div>{{ entry.roleLabel }}</div>
                <div><span class="cover-chip" [class.temporary]="entry.coverLabel === 'Temporary'">{{ entry.coverLabel }}</span></div>
                <div class="small text-muted">{{ effectiveDates(entry) }}</div>
                <div>
                  <button type="button" class="btn btn-quiet btn-icon"
                          (click)="assignmentEdit.emit(entry.assignment)"
                          [attr.aria-label]="'Edit ' + entry.roleLabel + ' assignment for ' + entry.parishName"
                          [tooltip]="'Edit the ' + entry.roleLabel + ' assignment for ' + entry.parishName"><fa-icon [icon]="faPenToSquare"/></button>
                </div>
              </div>
            }
          </div>
        </ng-template>
      </app-sortable-table>
    </div>

    <div class="supporter-cards d-md-none">
      @for (row of rows; track row.key) {
        <article class="supporter-card">
          <div class="supporter-card-heading">
            <div>
              <strong>{{ row.displayName }}</strong>
              @if (row.email) {
                <small>{{ row.email }}</small>
              }
            </div>
            <span class="status-chip" [class.inactive]="row.activeAssignmentCount === 0">{{ row.statusLabel }}</span>
          </div>
          <dl>
            <dt>Roles</dt>
            <dd>{{ row.roles }}</dd>
            <dt>Cover</dt>
            <dd>{{ row.cover }}</dd>
          </dl>
          <div class="assignment-list mobile">
            @for (entry of row.assignments; track entry.assignmentId) {
              <div class="assignment-entry mobile" [class.ended]="ended(entry)">
                <label class="assignment-select">
                  <input type="checkbox" [disabled]="ended(entry)" [checked]="assignmentSelected(entry)" (change)="toggleAssignment(row, entry)">
                </label>
                <div>
                  <button type="button" class="parish-link" (click)="parishSelect.emit(entry.parishName)">{{ entry.parishName }}</button>
                  <div class="small text-muted">{{ entry.roleLabel }} — {{ entry.coverLabel }}</div>
                  <div class="small text-muted">{{ effectiveDates(entry) }}</div>
                </div>
                <button type="button" class="btn btn-quiet btn-icon"
                        (click)="assignmentEdit.emit(entry.assignment)"
                        [attr.aria-label]="'Edit ' + entry.roleLabel + ' assignment for ' + entry.parishName"><fa-icon [icon]="faPenToSquare"/></button>
              </div>
            }
          </div>
        </article>
      } @empty {
        <p class="text-muted">No volunteers match the selected filters.</p>
      }
    </div>
  `,
  styles: [`
    :host
      display: flex
      flex-direction: column
      min-height: 0
    .table-fill
      flex: 1 1 auto
      min-height: 0
    .table-fill app-sortable-table
      display: block
      height: 100%
    .replacement-panel
      display: grid
      gap: var(--space-4)
      padding: var(--space-5)
      margin-bottom: var(--space-3)
      border: 1px solid var(--rsm-border)
      border-left: 8px solid var(--ramblers-colour-sunrise)
      border-radius: var(--rsm-panel-radius)
      background: var(--rsm-panel-bg)
    .replacement-heading
      display: flex
      align-items: start
      justify-content: space-between
      gap: var(--space-3)
    .replacement-heading h2
      margin: 0
      font-size: 1.25rem
    .replacement-form
      display: grid
      grid-template-columns: minmax(0, 1fr) auto
      gap: var(--space-3)
      align-items: end
    .replacement-form label
      display: grid
      gap: var(--space-2)
      font-weight: 600
    .replacement-preview ul
      margin: 0 0 var(--space-4)
      padding-left: var(--space-5)
    .replacement-preview .from-name
      text-decoration: line-through
      color: var(--rsm-muted)
    .replacement-actions
      display: flex
      gap: var(--space-2)
    .supporter-name
      display: flex
      align-items: start
      gap: var(--space-2)
    .unresolved
      color: #a15c00
    .status-chip
      display: inline-flex
      padding: var(--space-1) var(--space-2)
      border-radius: 999px
      background: #e7f6ec
      font-size: .85rem
      font-weight: 700
      white-space: nowrap
    .status-chip.inactive
      background: #fff1cc
    .cover-chip
      display: inline-flex
      padding: var(--space-1) var(--space-2)
      border-radius: 999px
      background: #eef1f4
      font-size: .8rem
      font-weight: 600
      white-space: nowrap
    .cover-chip.temporary
      background: #fde5dc
    .assignment-list
      display: grid
      gap: 0
      padding: 0
    .assignment-entry
      display: grid
      grid-template-columns: 32px minmax(0, 2fr) minmax(0, 1.5fr) auto minmax(0, 1.5fr) auto
      gap: var(--space-3)
      align-items: center
      padding: var(--space-2) var(--space-3)
    .assignment-entry:not(:last-child)
      border-bottom: 1px solid var(--rsm-border)
    .assignment-entry.ended
      opacity: .65
    .assignment-select
      display: flex
      align-items: center
      justify-content: center
      min-height: 40px
      margin: 0
    .assignment-select input
      width: 18px
      height: 18px
      accent-color: var(--ramblers-colour-sunrise)
    .parish-link
      display: inline
      padding: 0
      border: none
      background: none
      color: var(--rsm-text)
      text-align: left
      font-weight: 600
      text-decoration: underline
      text-decoration-style: dotted
    .supporter-cards
      display: grid
      gap: var(--space-3)
    .supporter-card
      padding: var(--space-4)
      border: 1px solid var(--rsm-border)
      border-radius: var(--rsm-panel-radius)
    .supporter-card-heading
      display: flex
      justify-content: space-between
      gap: var(--space-3)
    .supporter-card-heading small
      display: block
      color: var(--rsm-muted)
    .supporter-card dl
      display: grid
      grid-template-columns: 72px 1fr
      gap: var(--space-2)
      margin: var(--space-4) 0 0
    .supporter-card dt, .supporter-card dd
      margin: 0
    .assignment-entry.mobile
      grid-template-columns: 32px minmax(0, 1fr) auto
    @media (max-width: 767.98px)
      .replacement-form
        grid-template-columns: 1fr
      .replacement-heading
        align-items: stretch
        flex-direction: column
      .replacement-actions
        flex-direction: column
      .replacement-actions .btn, .replacement-heading .btn
        width: 100%
  `]
})
export class VolunteerSupporterView {
  private dateUtils = inject(DateUtilsService);
  protected readonly faChevronDown = faChevronDown;
  protected readonly faChevronRight = faChevronRight;
  protected readonly faPenToSquare = faPenToSquare;
  protected readonly faRightLeft = faRightLeft;
  protected readonly faTriangleExclamation = faTriangleExclamation;
  protected readonly VolunteerSupporterTableColumn = VolunteerSupporterTableColumn;
  protected readonly columns: SortableTableColumn<VolunteerSupporterRow>[] = [
    {key: VolunteerSupporterTableColumn.DISPLAY_NAME, label: "Volunteer", sortKey: VolunteerSupporterSortField.DISPLAY_NAME},
    {key: VolunteerSupporterTableColumn.ROLES, label: "Roles", sortKey: VolunteerSupporterSortField.ROLES},
    {key: VolunteerSupporterTableColumn.PARISHES, label: "Parishes", sortKey: VolunteerSupporterSortField.PARISHES},
    {key: VolunteerSupporterTableColumn.ACTIVE_ASSIGNMENT_COUNT, label: "Assignments", sortKey: VolunteerSupporterSortField.ACTIVE_ASSIGNMENT_COUNT},
    {key: VolunteerSupporterTableColumn.COVER, label: "Cover", sortKey: VolunteerSupporterSortField.COVER},
    {key: VolunteerSupporterTableColumn.STATUS, label: "Status", sortKey: VolunteerSupporterSortField.STATUS},
    {key: VolunteerSupporterTableColumn.ACTIONS, label: "Actions"}
  ];
  protected readonly trackSupporter = (_index: number, row: VolunteerSupporterRow): string => row.key;
  protected readonly rowExpanded = (row: VolunteerSupporterRow): boolean => row.key === this.expandedKey;

  @Input() rows: VolunteerSupporterRow[] = [];
  @Input() members: Member[] = [];
  @Input() saving = false;
  @Input() groupCode = "";
  @Input() sortField: string = VolunteerSupporterSortField.DISPLAY_NAME;
  @Input() sortDirection: string = ASCENDING;

  @Output() sortChange = new EventEmitter<SortableTableSortState>();
  @Output() assignmentEdit = new EventEmitter<VolunteerAssignment>();
  @Output() parishSelect = new EventEmitter<string>();
  @Output() bulkUpdate = new EventEmitter<VolunteerAssignmentBulkRequest>();

  protected readonly VolunteerAssignmentBulkAction = VolunteerAssignmentBulkAction;
  protected expandedKey: string | null = null;
  protected selectedAssignmentIds: string[] = [];
  protected replacementSourceName = "";
  protected replacementSupporter: Member | null = null;
  protected bulkAction = VolunteerAssignmentBulkAction.REPLACE_SUPPORTER;
  protected previewVisible = false;

  protected ended(entry: VolunteerSupporterAssignment): boolean {
    return entry.assignment.status === VolunteerAssignmentStatus.ENDED;
  }

  protected effectiveDates(entry: VolunteerSupporterAssignment): string {
    const from = entry.assignment.effectiveFrom ? this.dateUtils.displayDate(entry.assignment.effectiveFrom) : "";
    const to = entry.assignment.effectiveTo ? this.dateUtils.displayDate(entry.assignment.effectiveTo) : "";
    if (from && to) {
      return `${from} – ${to}`;
    } else if (from) {
      return `From ${from}`;
    } else if (to) {
      return `Until ${to}`;
    } else {
      return "Date not recorded";
    }
  }

  protected toggleExpanded(row: VolunteerSupporterRow): void {
    this.expandedKey = this.expandedKey === row.key ? null : row.key;
  }

  protected assignmentSelected(entry: VolunteerSupporterAssignment): boolean {
    return this.selectedAssignmentIds.includes(entry.assignmentId);
  }

  protected toggleAssignment(row: VolunteerSupporterRow, entry: VolunteerSupporterAssignment): void {
    const alreadySelected = this.assignmentSelected(entry);
    this.selectedAssignmentIds = alreadySelected
      ? this.selectedAssignmentIds.filter(assignmentId => assignmentId !== entry.assignmentId)
      : [...this.selectedAssignmentIds.filter(assignmentId => this.assignmentBelongsTo(row, assignmentId)), entry.assignmentId];
    this.replacementSourceName = this.selectedAssignmentIds.length > 0 ? row.displayName : "";
    this.previewVisible = false;
  }

  protected beginReplacement(row: VolunteerSupporterRow): void {
    this.expandedKey = row.key;
    this.selectedAssignmentIds = row.assignments
      .filter(entry => !this.ended(entry))
      .map(entry => entry.assignmentId);
    this.replacementSourceName = row.displayName;
    this.replacementSupporter = null;
    this.bulkAction = VolunteerAssignmentBulkAction.REPLACE_SUPPORTER;
    this.previewVisible = false;
  }

  protected cancelSelection(): void {
    this.selectedAssignmentIds = [];
    this.replacementSourceName = "";
    this.replacementSupporter = null;
    this.previewVisible = false;
  }

  protected get bulkActionReady(): boolean {
    return this.bulkAction === VolunteerAssignmentBulkAction.REPLACE_SUPPORTER ? !!this.replacementSupporter?.id : true;
  }

  protected get previewLines(): VolunteerAssignmentPreviewLine[] {
    return this.rows
      .flatMap(row => row.assignments)
      .filter(entry => this.selectedAssignmentIds.includes(entry.assignmentId))
      .map(entry => ({
        assignmentId: entry.assignmentId,
        parishName: entry.parishName,
        roleLabel: entry.roleLabel,
        currentValue: this.currentValueFor(entry),
        newValue: this.newValueFor()
      }));
  }

  protected confirmBulkAction(): void {
    if (this.bulkActionReady && this.selectedAssignmentIds.length > 0) {
      this.bulkUpdate.emit({
        groupCode: this.groupCode,
        action: this.bulkAction,
        supporterId: this.replacementSupporter?.id,
        assignmentIds: this.selectedAssignmentIds
      });
      this.cancelSelection();
    }
  }

  private currentValueFor(entry: VolunteerSupporterAssignment): string {
    if (this.bulkAction === VolunteerAssignmentBulkAction.REPLACE_SUPPORTER) {
      return this.replacementSourceName;
    } else if (this.bulkAction === VolunteerAssignmentBulkAction.END) {
      return "Active";
    } else {
      return entry.coverLabel;
    }
  }

  private newValueFor(): string {
    if (this.bulkAction === VolunteerAssignmentBulkAction.REPLACE_SUPPORTER) {
      return memberFullName(this.replacementSupporter);
    } else if (this.bulkAction === VolunteerAssignmentBulkAction.MARK_PERMANENT) {
      return "Permanent";
    } else if (this.bulkAction === VolunteerAssignmentBulkAction.MARK_TEMPORARY) {
      return "Temporary";
    } else {
      return "Ended";
    }
  }

  private assignmentBelongsTo(row: VolunteerSupporterRow, assignmentId: string): boolean {
    return row.assignments.some(entry => entry.assignmentId === assignmentId);
  }
}
