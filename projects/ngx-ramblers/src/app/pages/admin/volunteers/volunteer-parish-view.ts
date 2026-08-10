import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faGear, faPenToSquare, faPlus } from "@fortawesome/free-solid-svg-icons";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import {
  VolunteerParishSortField,
  VolunteerParishTableColumn,
  VolunteerParishTableRow
} from "../../../models/volunteer-management.model";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { ASCENDING } from "../../../models/table-filtering.model";

@Component({
  selector: "app-volunteer-parish-view",
  imports: [FontAwesomeModule, TooltipModule, SortableTableComponent, SortableTableCellDirective],
  template: `
    <div class="d-none d-md-block table-fill">
      <app-sortable-table
        [columns]="columns"
        [rows]="rows"
        [defaultSortKey]="sortField"
        [defaultSortDirection]="sortDirection"
        [trackBy]="trackParish"
        [maxHeight]="'100%'"
        emptyMessage="No parishes match the selected filters."
        (sortChange)="sortChange.emit($event)"
        (rowSelect)="parishSelect.emit($event)">
        <ng-template [appSortableTableCell]="VolunteerParishTableColumn.PARISH_NAME" let-parish>
          <strong>{{ parish.parishName }}</strong>
          <div class="small text-muted">{{ parish.parishCode }}</div>
        </ng-template>
        <ng-template [appSortableTableCell]="VolunteerParishTableColumn.AUTHORITY" let-parish>
          {{ parish.localAuthorityName || "—" }}
          <div class="small text-muted">{{ parish.sectorCode || "" }}</div>
        </ng-template>
        <ng-template [appSortableTableCell]="VolunteerParishTableColumn.LOCAL_FOOTPATH_OFFICER" let-parish>
          @if (parish.localFootpathOfficerNames.length > 0) {
            @for (name of parish.localFootpathOfficerNames; track name) {
              <button type="button" class="supporter-link" (click)="$event.stopPropagation(); supporterSelect.emit(name)"
                      [tooltip]="'Show ' + name + ' in the volunteers view'">{{ name }}</button>
            }
          } @else {
            <span class="text-muted">Vacant</span>
          }
        </ng-template>
        <ng-template [appSortableTableCell]="VolunteerParishTableColumn.PARISH_FOOTPATH_OBSERVER" let-parish>
          @if (parish.parishFootpathObserverNames.length > 0) {
            @for (name of parish.parishFootpathObserverNames; track name) {
              <button type="button" class="supporter-link" (click)="$event.stopPropagation(); supporterSelect.emit(name)"
                      [tooltip]="'Show ' + name + ' in the volunteers view'">{{ name }}</button>
            }
          } @else {
            <span class="text-muted">Vacant</span>
          }
        </ng-template>
        <ng-template [appSortableTableCell]="VolunteerParishTableColumn.COVERAGE" let-parish>
          <span class="coverage-chip" [class.has-vacancy]="parish.hasVacancy">{{ parish.coverage }}</span>
        </ng-template>
        <ng-template [appSortableTableCell]="VolunteerParishTableColumn.ACTIONS" let-parish>
          <div class="row-actions">
            <button type="button" class="btn btn-quiet btn-icon"
                    (click)="$event.stopPropagation(); assignmentAdd.emit(parish)"
                    [attr.aria-label]="'Add assignment for ' + parish.parishName"
                    [tooltip]="'Add an LFO or PFO assignment for ' + parish.parishName"><fa-icon [icon]="faPlus"/></button>
            <button type="button" class="btn btn-quiet btn-icon"
                    (click)="$event.stopPropagation(); parishSelect.emit(parish)"
                    [attr.aria-label]="'Edit assignment for ' + parish.parishName"
                    [tooltip]="editTooltip(parish)"><fa-icon [icon]="faPenToSquare"/></button>
            <button type="button" class="btn btn-quiet btn-icon"
                    (click)="$event.stopPropagation(); parishEdit.emit(parish)"
                    [attr.aria-label]="'Edit parish details for ' + parish.parishName"
                    [tooltip]="'Edit the code, groupings and vacancy status for ' + parish.parishName"><fa-icon [icon]="faGear"/></button>
          </div>
        </ng-template>
      </app-sortable-table>
    </div>

    <div class="parish-cards d-md-none">
      @for (parish of rows; track parish.parishCode) {
        <article class="parish-card clickable-parish" role="button" tabindex="0"
                 (click)="parishSelect.emit(parish)" (keydown.enter)="parishSelect.emit(parish)">
          <div class="parish-card-heading">
            <div><strong>{{ parish.parishName }}</strong><small>{{ parish.parishCode }}</small></div>
            <span class="coverage-chip" [class.has-vacancy]="parish.hasVacancy">{{ parish.coverage }}</span>
          </div>
          <dl>
            <dt>LFO</dt>
            <dd>{{ parish.localFootpathOfficer }}</dd>
            <dt>PFO</dt>
            <dd>{{ parish.parishFootpathObserver }}</dd>
          </dl>
          <button type="button" class="parish-contacts-link" (click)="$event.stopPropagation(); contactsSelect.emit(parish)">Contacts for this parish</button>
          <div class="mobile-actions">
            <button type="button" class="btn btn-quiet btn-icon"
                    (click)="$event.stopPropagation(); assignmentAdd.emit(parish)"
                    [attr.aria-label]="'Add assignment for ' + parish.parishName"
                    [tooltip]="'Add an LFO or PFO assignment for ' + parish.parishName"><fa-icon [icon]="faPlus"/></button>
            <button type="button" class="btn btn-quiet btn-icon"
                    (click)="$event.stopPropagation(); parishSelect.emit(parish)"
                    [attr.aria-label]="'Edit assignment for ' + parish.parishName"
                    [tooltip]="editTooltip(parish)"><fa-icon [icon]="faPenToSquare"/></button>
            <button type="button" class="btn btn-quiet btn-icon"
                    (click)="$event.stopPropagation(); parishEdit.emit(parish)"
                    [attr.aria-label]="'Edit parish details for ' + parish.parishName"><fa-icon [icon]="faGear"/></button>
          </div>
        </article>
      } @empty {
        <p class="text-muted">No parishes match the selected filters.</p>
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
    .row-actions, .mobile-actions
      display: flex
      gap: var(--space-2)
    .mobile-actions
      margin-top: var(--space-4)
      flex-wrap: wrap
    .parish-contacts-link
      display: inline-block
      margin-top: var(--space-3)
      padding: 0
      border: none
      background: none
      color: var(--rsm-text)
      text-decoration: underline
      text-decoration-style: dotted
    .supporter-link
      display: inline
      padding: 0
      border: none
      background: none
      color: var(--rsm-text)
      text-align: left
      text-decoration: underline
      text-decoration-style: dotted
    .supporter-link:hover
      color: var(--ramblers-colour-sunrise-darker, #b97d00)
    .supporter-link + .supporter-link::before
      content: ", "
      text-decoration: none
    .clickable-parish
      cursor: pointer
    .clickable-parish:hover
      background: var(--rsm-row-hover)
    .coverage-chip
      display: inline-flex
      padding: var(--space-1) var(--space-2)
      border-radius: 999px
      background: #e7f6ec
      font-size: .85rem
      font-weight: 700
      white-space: nowrap
    .coverage-chip.has-vacancy
      background: #fff1cc
    .parish-cards
      display: grid
      gap: var(--space-3)
    .parish-card
      padding: var(--space-4)
      border: 1px solid var(--rsm-border)
      border-radius: var(--rsm-panel-radius)
    .parish-card-heading
      display: flex
      justify-content: space-between
      gap: var(--space-3)
    .parish-card-heading small
      display: block
      color: var(--rsm-muted)
    .parish-card dl
      display: grid
      grid-template-columns: 48px 1fr
      gap: var(--space-2)
      margin: var(--space-4) 0 0
    .parish-card dt, .parish-card dd
      margin: 0
  `]
})
export class VolunteerParishView {
  protected readonly faPenToSquare = faPenToSquare;
  protected readonly faPlus = faPlus;
  protected readonly faGear = faGear;
  protected readonly VolunteerParishTableColumn = VolunteerParishTableColumn;
  protected readonly columns: SortableTableColumn<VolunteerParishTableRow>[] = [
    {key: VolunteerParishTableColumn.PARISH_NAME, label: "Parish", sortKey: VolunteerParishSortField.PARISH_NAME},
    {key: VolunteerParishTableColumn.AUTHORITY, label: "Authority / sector", sortKey: VolunteerParishSortField.AUTHORITY},
    {key: VolunteerParishTableColumn.LOCAL_FOOTPATH_OFFICER, label: "LFO", sortKey: VolunteerParishSortField.LOCAL_FOOTPATH_OFFICER},
    {key: VolunteerParishTableColumn.PARISH_FOOTPATH_OBSERVER, label: "PFO", sortKey: VolunteerParishSortField.PARISH_FOOTPATH_OBSERVER},
    {key: VolunteerParishTableColumn.COVERAGE, label: "Coverage", sortKey: VolunteerParishSortField.COVERAGE},
    {key: VolunteerParishTableColumn.ACTIONS, label: "Actions"}
  ];
  protected readonly trackParish = (_index: number, parish: VolunteerParishTableRow): string => parish.parishCode;

  @Input() rows: VolunteerParishTableRow[] = [];
  @Input() sortField: string = VolunteerParishSortField.PARISH_NAME;
  @Input() sortDirection: string = ASCENDING;

  @Output() sortChange = new EventEmitter<SortableTableSortState>();
  @Output() parishSelect = new EventEmitter<VolunteerParishTableRow>();
  @Output() assignmentAdd = new EventEmitter<VolunteerParishTableRow>();
  @Output() supporterSelect = new EventEmitter<string>();
  @Output() parishEdit = new EventEmitter<VolunteerParishTableRow>();
  @Output() contactsSelect = new EventEmitter<VolunteerParishTableRow>();

  protected editTooltip(parish: VolunteerParishTableRow): string {
    return parish.assignmentCount > 0
      ? `Edit the current assignment for ${parish.parishName}`
      : `No current assignment for ${parish.parishName}; open the assignment form`;
  }
}
