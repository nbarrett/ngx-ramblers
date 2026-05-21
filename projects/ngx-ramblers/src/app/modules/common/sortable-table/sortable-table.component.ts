import { AfterContentInit, Component, ContentChildren, EventEmitter, Input, OnChanges, Output, QueryList, SimpleChanges, TemplateRef } from "@angular/core";
import { NgTemplateOutlet } from "@angular/common";
import { FontAwesomeModule } from "@fortawesome/angular-fontawesome";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { ASCENDING, DESCENDING } from "../../../models/table-filtering.model";
import { sortBy } from "../../../functions/arrays";
import { SortableTableAlignment, SortableTableColumn, SortableTableSortState } from "./sortable-table.model";
import { SortableTableCellDirective } from "./sortable-table-cell.directive";

@Component({
  selector: "app-sortable-table",
  standalone: true,
  imports: [NgTemplateOutlet, FontAwesomeModule],
  template: `
    <div class="sortable-table-card">
      <table class="sortable-table">
        <thead>
          <tr>
            @for (column of columns; track column.key) {
              <th [class]="headerClassFor(column)"
                  [class.sortable]="!!column.sortKey"
                  (click)="column.sortKey && toggleSort(column.sortKey)">
                {{ column.label }}
                @if (sortKey && column.sortKey === sortKey) {
                  <fa-icon [icon]="sortDirection === ASCENDING ? faChevronUp : faChevronDown" class="ms-1" size="xs"/>
                }
              </th>
            }
          </tr>
        </thead>
        <tbody>
          @if (sortedRows.length === 0) {
            <tr>
              <td [attr.colspan]="columns.length" class="text-center text-muted py-3">{{ emptyMessage }}</td>
            </tr>
          }
          @for (row of sortedRows; track trackRow($index, row)) {
            <tr>
              @for (column of columns; track column.key) {
                <td [class]="cellClassFor(column)">
                  @if (templateFor(column.key); as cellTemplate) {
                    <ng-container *ngTemplateOutlet="cellTemplate; context: { $implicit: row, row: row }"></ng-container>
                  } @else {
                    {{ column.cellGetter ? column.cellGetter(row) : "" }}
                  }
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  styles: [`
    :host
      display: block

    .sortable-table-card
      border: 1px solid rgba(155, 200, 171, 0.4)
      border-radius: 8px
      overflow: hidden
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08)
      background: white

    .sortable-table
      width: 100%
      border-collapse: separate
      border-spacing: 0
      margin-bottom: 0

    .sortable-table th
      background: linear-gradient(to bottom, rgba(155, 200, 171, 0.3), rgba(155, 200, 171, 0.15))
      color: #495057
      font-weight: 600
      text-align: left
      padding: 12px 16px
      border-bottom: 2px solid rgba(155, 200, 171, 0.4)
      font-size: 0.85rem

    .sortable-table th.sortable
      cursor: pointer
      user-select: none

    .sortable-table th.sortable:hover
      background: rgba(155, 200, 171, 0.4)

    .sortable-table th.text-center
      text-align: center

    .sortable-table th.text-right
      text-align: right

    .sortable-table tbody tr td
      padding: 12px 16px
      vertical-align: middle
      border-bottom: 1px solid #e9ecef
      font-size: 0.9rem
      transition: background-color 0.15s ease
      word-break: break-word

    .sortable-table tbody tr:last-child td
      border-bottom: none

    .sortable-table tbody tr:nth-child(odd)
      background-color: #ffffff

    .sortable-table tbody tr:nth-child(even)
      background-color: #f8f9fa

    .sortable-table tbody tr:hover
      background-color: rgba(155, 200, 171, 0.1)

    .sortable-table tbody td.text-center
      text-align: center

    .sortable-table tbody td.text-right
      text-align: right
  `]
})
export class SortableTableComponent implements OnChanges, AfterContentInit {

  @Input() columns: SortableTableColumn[] = [];
  @Input() rows: any[] = [];
  @Input() defaultSortKey: string | null = null;
  @Input() defaultSortDirection: string = ASCENDING;
  @Input() emptyMessage: string = "No data to display";
  @Input() trackBy: (index: number, row: any) => any = (index) => index;
  @Output() sortChange = new EventEmitter<SortableTableSortState>();

  @ContentChildren(SortableTableCellDirective) protected cellTemplates!: QueryList<SortableTableCellDirective>;

  protected sortKey: string | null = null;
  protected sortDirection: string = ASCENDING;
  protected sortedRows: any[] = [];

  protected readonly ASCENDING = ASCENDING;
  protected readonly DESCENDING = DESCENDING;
  protected readonly faChevronUp = faChevronUp;
  protected readonly faChevronDown = faChevronDown;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["defaultSortKey"] && this.sortKey === null) {
      this.sortKey = this.defaultSortKey;
      this.sortDirection = this.defaultSortDirection;
    }
    if (changes["rows"] || changes["columns"]) {
      this.applySort();
    }
  }

  ngAfterContentInit(): void {
    if (this.sortKey === null && this.defaultSortKey) {
      this.sortKey = this.defaultSortKey;
      this.sortDirection = this.defaultSortDirection;
    }
    this.applySort();
  }

  protected toggleSort(sortKey: string): void {
    if (this.sortKey === sortKey) {
      this.sortDirection = this.sortDirection === ASCENDING ? DESCENDING : ASCENDING;
    } else {
      this.sortKey = sortKey;
      this.sortDirection = ASCENDING;
    }
    this.applySort();
    this.sortChange.emit({ key: this.sortKey, direction: this.sortDirection });
  }

  protected templateFor(key: string): TemplateRef<any> | null {
    const match = this.cellTemplates?.find(entry => entry.key === key);
    return match?.template ?? null;
  }

  protected trackRow(index: number, row: any): any {
    return this.trackBy ? this.trackBy(index, row) : index;
  }

  protected headerClassFor(column: SortableTableColumn): string {
    const parts: string[] = [];
    if (column.headerClass) parts.push(column.headerClass);
    if (column.align === SortableTableAlignment.CENTER) parts.push("text-center");
    if (column.align === SortableTableAlignment.RIGHT) parts.push("text-right");
    return parts.join(" ");
  }

  protected cellClassFor(column: SortableTableColumn): string {
    const parts: string[] = [];
    if (column.cellClass) parts.push(column.cellClass);
    if (column.align === SortableTableAlignment.CENTER) parts.push("text-center");
    if (column.align === SortableTableAlignment.RIGHT) parts.push("text-right");
    return parts.join(" ");
  }

  private applySort(): void {
    const source = this.rows || [];
    if (!this.sortKey) {
      this.sortedRows = [...source];
      return;
    }
    const prefix = this.sortDirection === DESCENDING ? "-" : "";
    this.sortedRows = [...source].sort(sortBy(`${prefix}${this.sortKey}`));
  }
}
