import { Component, EventEmitter, Input, Output } from "@angular/core";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faLink, faPenToSquare } from "@fortawesome/free-solid-svg-icons";
import { TooltipModule } from "ngx-bootstrap/tooltip";
import {
  ExternalContactRow,
  ExternalContactSortField,
  ExternalContactTableColumn
} from "../../../models/external-recipient.model";
import { SortableTableComponent } from "../../../modules/common/sortable-table/sortable-table.component";
import { SortableTableCellDirective } from "../../../modules/common/sortable-table/sortable-table-cell.directive";
import { SortableTableColumn, SortableTableSortState } from "../../../modules/common/sortable-table/sortable-table.model";
import { ASCENDING } from "../../../models/table-filtering.model";

@Component({
  selector: "app-volunteer-contact-view",
  imports: [FontAwesomeModule, TooltipModule, SortableTableComponent, SortableTableCellDirective],
  template: `
    <div class="d-none d-md-block table-fill">
      <app-sortable-table
        [columns]="columns"
        [rows]="rows"
        [defaultSortKey]="sortField"
        [defaultSortDirection]="sortDirection"
        [trackBy]="trackContact"
        [maxHeight]="'100%'"
        emptyMessage="No contacts match the selected filters."
        (sortChange)="sortChange.emit($event)"
        (rowSelect)="contactSelect.emit($event)">
        <ng-template [appSortableTableCell]="ExternalContactTableColumn.DISPLAY_NAME" let-contact>
          <strong>{{ contact.displayName }}</strong>
          @if (contact.roleTitle) {
            <div class="small text-muted">{{ contact.roleTitle }}</div>
          }
          @if (contact.supporterName) {
            <div class="small linked-supporter"><fa-icon [icon]="faLink"/> Linked to {{ contact.supporterName }}</div>
          }
        </ng-template>
        <ng-template [appSortableTableCell]="ExternalContactTableColumn.CONTACT_TYPE_LABEL" let-contact>
          <span class="type-chip">{{ contact.contactTypeLabel }}</span>
        </ng-template>
        <ng-template [appSortableTableCell]="ExternalContactTableColumn.EMAIL" let-contact>{{ contact.email }}</ng-template>
        <ng-template [appSortableTableCell]="ExternalContactTableColumn.TELEPHONE" let-contact>{{ contact.telephone || "—" }}</ng-template>
        <ng-template [appSortableTableCell]="ExternalContactTableColumn.LINKED_PARISH_COUNT" let-contact>
          <span [tooltip]="contact.linkedParishNames">{{ contact.linkedParishCount }}</span>
        </ng-template>
        <ng-template [appSortableTableCell]="ExternalContactTableColumn.ACTIONS" let-contact>
          <button type="button" class="btn btn-quiet btn-icon"
                  (click)="$event.stopPropagation(); contactSelect.emit(contact)"
                  [attr.aria-label]="'Edit ' + contact.displayName"
                  [tooltip]="'Edit ' + contact.displayName"><fa-icon [icon]="faPenToSquare"/></button>
        </ng-template>
      </app-sortable-table>
    </div>

    <div class="contact-cards d-md-none">
      @for (contact of rows; track contact.id) {
        <article class="contact-card" role="button" tabindex="0"
                 (click)="contactSelect.emit(contact)" (keydown.enter)="contactSelect.emit(contact)">
          <div class="contact-card-heading">
            <div><strong>{{ contact.displayName }}</strong><small>{{ contact.roleTitle }}</small></div>
            <span class="type-chip">{{ contact.contactTypeLabel }}</span>
          </div>
          <dl>
            <dt>Email</dt>
            <dd>{{ contact.email }}</dd>
            <dt>Phone</dt>
            <dd>{{ contact.telephone || "—" }}</dd>
            <dt>Parishes</dt>
            <dd>{{ contact.linkedParishNames || "—" }}</dd>
          </dl>
        </article>
      } @empty {
        <p class="text-muted">No contacts match the selected filters.</p>
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
    .type-chip
      display: inline-flex
      padding: var(--space-1) var(--space-2)
      border-radius: 999px
      background: #eef1f4
      font-size: .8rem
      font-weight: 600
      white-space: nowrap
    .linked-supporter
      color: #2f6f4f
    .contact-cards
      display: grid
      gap: var(--space-3)
    .contact-card
      padding: var(--space-4)
      border: 1px solid var(--rsm-border)
      border-radius: var(--rsm-panel-radius)
      cursor: pointer
    .contact-card-heading
      display: flex
      justify-content: space-between
      gap: var(--space-3)
    .contact-card-heading small
      display: block
      color: var(--rsm-muted)
    .contact-card dl
      display: grid
      grid-template-columns: 72px 1fr
      gap: var(--space-2)
      margin: var(--space-4) 0 0
    .contact-card dt, .contact-card dd
      margin: 0
    .contact-card dd
      min-width: 0
      overflow-wrap: anywhere
  `]
})
export class VolunteerContactView {
  protected readonly faPenToSquare = faPenToSquare;
  protected readonly faLink = faLink;
  protected readonly ExternalContactTableColumn = ExternalContactTableColumn;
  protected readonly columns: SortableTableColumn<ExternalContactRow>[] = [
    {key: ExternalContactTableColumn.DISPLAY_NAME, label: "Contact", sortKey: ExternalContactSortField.DISPLAY_NAME},
    {key: ExternalContactTableColumn.CONTACT_TYPE_LABEL, label: "Type", sortKey: ExternalContactSortField.CONTACT_TYPE_LABEL},
    {key: ExternalContactTableColumn.EMAIL, label: "Email", sortKey: ExternalContactSortField.EMAIL},
    {key: ExternalContactTableColumn.TELEPHONE, label: "Phone"},
    {key: ExternalContactTableColumn.LINKED_PARISH_COUNT, label: "Parishes", sortKey: ExternalContactSortField.LINKED_PARISH_COUNT},
    {key: ExternalContactTableColumn.ACTIONS, label: "Actions"}
  ];
  protected readonly trackContact = (_index: number, contact: ExternalContactRow): string => contact.id;

  @Input() rows: ExternalContactRow[] = [];
  @Input() sortField: string = ExternalContactSortField.DISPLAY_NAME;
  @Input() sortDirection: string = ASCENDING;

  @Output() sortChange = new EventEmitter<SortableTableSortState>();
  @Output() contactSelect = new EventEmitter<ExternalContactRow>();
}
